/*
 * == BSD2 LICENSE ==
 */

var util = require('util');

var _ = require('lodash');

var schema = require('./schema.js');

var idFields = ['type', 'subType', 'deviceId', 'time'];
schema.registerIdFields('bolus', idFields);

module.exports = function(streamDAO){
  return schema.makeSubHandler(
    'bolus',
    'subType',
    [
      schema.makeHandler(
        'injected',
        {
          schema: {
            value: schema.isNumber,
            insulin: schema.in('novolog', 'humalog')
          }
        }
      ),
      schema.makeHandler(
        'normal',
        {
          schema: {
            normal: schema.isNumber
          },
          transform: function(datum, cb) {
            if (datum.previous == null) {
              return cb(null, datum);
            } else {
              var prevId = schema.generateId(datum.previous, idFields);

              streamDAO.getDatum(prevId, datum._groupId, function(err, prev){
                if (err != null) {
                  return cb(err);
                }

                if (prev.normal !== datum.normal) {
                  prev = _.clone(prev);
                  prev.expectedNormal = prev.normal;
                  prev.normal = datum.normal;
                  return cb(null, prev);
                }

                return cb(null, []);
              });
            }
          }
        }
      ),
      schema.makeHandler(
        'square',
        {
          schema: {
            extended: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThanEq(0))
          },
          transform: function(datum, cb){
            if (datum.previous == null) {
              return cb(null, datum);
            } else {
              var prevId = schema.generateId(datum.previous, idFields);

              streamDAO.getDatum(prevId, datum._groupId, function(err, prev){
                if (err != null) {
                  return cb(err);
                }

                if (prev.extended !== datum.extended || prev.duration !== datum.duration) {
                  prev = _.clone(prev);
                  if (prev.extended !== datum.extended) {
                    prev.expectedExtended = prev.extended;
                    prev.extended = datum.extended;
                  }

                  if (prev.duration !== datum.duration) {
                    prev.expectedDuration = prev.duration;
                    prev.duration = datum.duration;
                  }

                  return cb(null, prev);
                }

                return cb(null, []);
              });
            }
          }
        }
      ),
      schema.makeHandler(
        'dual/square',
        {
          schema: {
            normal: schema.isNumber,
            extended: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThanEq(0))
          }
        }
      )
    ]
  );
};