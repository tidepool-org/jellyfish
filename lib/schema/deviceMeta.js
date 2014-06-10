/*
 * == BSD2 LICENSE ==
 */

var util = require('util');

var _ = require('lodash');

var schema = require('./schema.js');

var idFields = ['type', 'subType', 'time'];
function makeHandler(key, spec) {
  if (spec.id == null) {
    spec.id = idFields;
  }
  return schema.makeHandler(key, spec);
}

var suspendedReasons = {
  'manual': true,
  'low_glucose': true,
  'alarm': true
};

var resumedReasons = {
  'manual': true,
  'automatic': true
};

module.exports = function(streamDAO){
  var subHandlersArray = [
    makeHandler(
      'calibration',
      {
        schema: {
          value: schema.isNumber
        },
        transform: function(datum, cb) {
          return cb(null, schema.convertUnits(datum, 'value'));
        }
      }
    ),
    makeHandler(
      'status',
      {
        schema: {
          status: schema.in('suspended', 'resumed'),
          reason: schema.in(Object.keys(suspendedReasons), Object.keys(resumedReasons)),
          previous: schema.ifExists(schema.isObject)
        },
        transform: function(datum, cb) {
          if ( (datum.status === 'suspended' && !suspendedReasons[datum.reason])
            || (datum.status === 'resumed' && !resumedReasons[datum.reason]) ) {
            return cb(
              { statusCode: 400, message: util.format('Unknown reason[%s] for status[%s]', datum.reason, datum.status) }
            );
          }

          if (datum.previous != null) {
            var previous = schema.attachIds(_.clone(datum.previous), idFields);
            var newDatum = _.assign({}, datum, {previous: previous.id});

            streamDAO.getDatum(previous._id, function(err, prev){
              if (! _.isEqual(datum.previous, _.pick(prev, Object.keys(datum.previous)))) {
                return cb(null, [datum.previous, newDatum]);
              } else {
                return cb(null, newDatum);
              }
            });
          } else {
            return cb(null, datum);
          }
        }
      }
    )
  ];

  var subHandlers = {};
  for (var i = 0; i < subHandlersArray.length; ++i) {
    subHandlers[subHandlersArray[i].key] = subHandlersArray[i];
  }
  var knownTypes = Object.keys(subHandlers);

  var retVal = function (datum, cb) {
    var type = datum.subType;
    var subHandler = subHandlers[type];
    if (subHandler == null) {
      return cb(
        { statusCode: 400, message: util.format('unknown deliveryType[%s], known types are [%s]', type, knownTypes) }
      );
    }

    subHandler(datum, cb);
  };

  retVal.key = 'deviceMeta';

  return  retVal;
};