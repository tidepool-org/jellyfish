/*
 * == BSD2 LICENSE ==
 */

var util = require('util');

var _ = require('lodash');

var schema = require('./schema.js');

var idFields = ['type', 'deliveryType', 'deviceId', 'time'];
function makeHandler(key, spec) {
  if (spec.id == null) {
    spec.id = idFields;
  }
  return schema.makeHandler(key, spec);
}

module.exports = function(streamDAO){
  function updatePreviousDuration(datum, cb) {
    if (datum.previous != null) {
      var prev = schema.attachIds(datum.previous, idFields);

      streamDAO.getDatum(prev._id, function(err, actualPrev){
        if (err != null) {
          return cb(err);
        }

        var eventsToStore = [];

        var actualDuration = Date.parse(datum.time) - Date.parse(actualPrev.time);
        if (actualDuration !== actualPrev.duration) {
          eventsToStore.push(
            _.assign({}, actualPrev, {duration: actualDuration, expectedDuration: actualPrev.duration})
          );
        }
        eventsToStore.push(_.omit(datum, 'previous'));
        cb(null, eventsToStore);
      });
    } else {
      cb(null, datum);
    }
  }

  return schema.makeSubHandler(
    'basal',
    'deliveryType',
    [
      makeHandler(
        'injected',
        {
          schema: {
            value: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThan(0)),
            insulin: schema.in('novolog', 'levemir', 'lantus', 'humalog')
          }
        }
      ),
      makeHandler(
        'scheduled',
        {
          schema: {
            scheduleName: schema.isString,
            rate: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThan(0)),
            previous: schema.ifExists(schema.isObject),
            suppressed: schema.ifExists(schema.isObject)
          },
          transform: updatePreviousDuration
        }
      ),
      makeHandler(
        'temp',
        {
          schema: {
            rate: schema.ifExists(schema.isNumber),
            percent: schema.ifExists(schema.and(schema.isNumber, schema.greaterThanEq(0), schema.lessThanEq(1))),
            duration: schema.and(schema.isNumber, schema.greaterThan(0)),
            previous: schema.ifExists(schema.isObject),
            suppressed: schema.isObject
          },
          transform: function(datum, cb){
            if (datum.rate == null && datum.percent != null) {
              datum.rate = datum.suppressed.rate * datum.percent;
            }

            if (datum.rate == null && datum.percent == null) {
              return cb({ statusCode: 400, message: 'type[temp] must have either rate or percent specified.'});
            }

            return updatePreviousDuration(datum, cb);
          }
        }
      )
    ]
  );
};