/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');
var mongodb = require('mongodb-legacy');
var pre = require('amoeba').pre;
var getDatabaseName = require('amoeba').mongoUtil.getDatabaseName;
var util = require('util');

var log = require('../log.js')('mongoClient.js');

module.exports = function (config) {
  config = _.clone(config);
  pre.hasProperty(config, 'connectionString');
  pre.defaultProperty(config, 'closeDelay', 60 * 1000);
  pre.defaultProperty(config, 'closePollDelay', 5000);


  var mongoClient = null;
  var started = false;
  var requestCount = 0;
  var databaseName = 'data';

  function closeWhenRequestsDone(clientRef, timeElapsed, cb) {
    if (requestCount > 0) {
      if (timeElapsed >= config.closeDelay) {
        log.warn('Forcibly closing mongo because operations didn\'t clear out within [%s] millis', config.closeDelay);
        clientRef.close(cb);
      } else {
        setTimeout(
          closeWhenRequestsDone.bind(null, clientRef, timeElapsed + config.closePollDelay, cb),
          config.closePollDelay
        );
      }
    } else {
      log.info('Closing mongo client');
      clientRef.close(cb);
    }
  }

  return {
    /**
     * Provides the requested collection object from Mongo to the collCb.
     *
     * The function signature on this method is a little funky because it attempts to do
     * request counting in order to handle the close() method gracefully.  The collCb will be
     * passed a callback that it *must* use.  This callback wraps the clientCb passed in here,
     * but decrements the request counter before calling it.
     *
     * Not using the callback passed to collCb will result in incorrect counts and elongated
     * `close()` times.
     *
     * @param {string} collectionName - name of the mongo collection to get
     * @param clientCb Callback from the user, if an error occurs, this will short-circuit to this callback directly.
     * @param collCb callback that is passed the collection as the first argument and a callback as the second argument,
     *   the callback passed into collCb *must* be called from collCb
     * @returns {*}
     */
    withCollection: function (collectionName, clientCb, collCb) {
      if (!started) {
        return clientCb(new Error('Must start the mongoClient before using it.'));
      }

      if (mongoClient == null) {
        return clientCb(new Error('Client closing, cannot be used.'));
      }
      var collection = mongoClient.db(databaseName).collection(collectionName);
      process.nextTick(() => {
        var requestComplete = false;
        ++requestCount;
        collCb(collection, function () {
          if (!requestComplete) {
            requestComplete = true;
            --requestCount;
          }
          clientCb.apply(null, Array.prototype.slice.call(arguments, 0));
        });
      });
    },
    /**
     * Returns a collection synchronously as the newest mongodb driver no
     * longer takes a callback. Use withCallback instead if the old callback
     * behaviour is expected.
     *
     * @param {string} collectionName - name of the mongo collection to get.
     * @returns {mongodb.Collection}
     */
    collection: function(collectionName) {
      return mongoClient.db(databaseName).collection(collectionName);
    },

    /**
     * Callback that gets the result of a call to mongoClient.transact.
     * @callback transactCallback
     * @param  {Error} err - error if any
     * @param  {*} result - result if any
     */

    /**
     * This is equivalent to the Node.js mongodb driver's
     * WithTransactionCallback. It is an asynchronous function that is ran in
     * a transaction and must use the supplied session in all its
     * operations.
     * @async
     * @function transactFunction
     * @param  {mongodb.ClientSession} session
     * @return {*} - anything
     */

    /**
     *  This is a helper around transactions that hides the setup and closing
     *  of transaction sessions from the client while maintaining the
     *  existing request counting logic of .withCollection as well as
     *  automatically retrying the tx in case of certain failures.
     *
     * @param {transactFunction} asyncFn - Asynchronous function that will be wrapped in a transaction.
     * @param {transactCallback} cb
     */
    transact: function(asyncFn, cb) {
      async function run() {
        const txOpts = {
          // Use majority read concern to get majority acknowledged
          // modifications that have committed. Don't use snapshot as we want
          // any reads to get any updated data that other transactions may
          // have committed if this transaction fails and has to be retried.
          readConcern: { level: 'majority' },
          writeConcern: { w: 'majority', j: true }
        };
        const session = mongoClient.startSession();
        try {
          ++requestCount;
          // Only the callback API supports automatic retries so we are using
          // that here.
          await session.withTransaction(asyncFn, txOpts);
        }
        finally {
          await session.endSession();
          --requestCount;
        }
        // All errors will be captured in callbackify and passed to cb
      }
      util.callbackify(run)(cb);
    },
    healthCheck() {
      return !!mongoClient && !!mongoClient.topology && !!mongoClient.topology.isConnected();
    },
    start: function (cb) {
      if (cb == null) {
        cb = function (err) {
          if (err != null) {
            log.warn(err, 'Error connection to mongo!');
            return;
          }
          log.info('Successfully connected to mongo');
        };
      }

      if (started) {
        return cb(new Error('Already started'));
      }
      requestCount = 0;

      var client = new mongodb.MongoClient(config.connectionString, { useNewUrlParser: true });
      databaseName = getDatabaseName(config.connectionString, 'data');
      client.connect(function (err) {
        if (client != null) {
          if (mongoClient != null) {
            client.close();
            return;
          }
          started = true;
          mongoClient = client;
        }

        if (!config.disableIndexCreation) {
          mongoClient.db(databaseName).createIndex('deviceData',
            {
              '_groupId': 1,
              'deviceId': 1,
              'source': 1,
              'time': -1,
            },
            {
              'name': 'JellyfishBasalSearch_v2',
              'background': true,
              'partialFilterExpression': {
                'type': 'basal',
                '_active': true,
              }
            },
            function (indexError) {
              if (indexError) {
                return cb(indexError);
              }
            }
          );
        }

        cb(err);
      });
    },
    close: function (cb) {
      if (started) {
        closeWhenRequestsDone(mongoClient, 0, function (err, results) {
          started = false;
          if (cb != null) {
            cb(err, results);
          }
        });
        mongoClient = null;
      }
    }
  };
};
