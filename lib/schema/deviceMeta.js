/*
 * == BSD2 LICENSE ==
 */

var util = require('util');

var _ = require('lodash');

var schema = require('./schema.js');

var idFields = ['type', 'subType', 'time'];
schema.registerIdFields('deviceMeta', idFields);

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
  return schema.makeSubHandler(
    'deviceMeta',
    'subType',
    [
      schema.makeHandler(
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
      schema.makeHandler(
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
              var prevId = schema.generateId(datum.previous, idFields);
              var newDatum = _.assign({}, datum, {previous: prevId});

              streamDAO.getDatum(prevId, datum._groupId, function(err, prev){
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
    ]
  );
};