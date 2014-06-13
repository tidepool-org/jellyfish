/*
 * == BSD2 LICENSE ==
 */

var util = require('util');

var _ = require('lodash');

var schema = require('./schema.js');

var idFields = ['type', 'subType', 'deviceId', 'time'];
function makeHandler(key, spec) {
  if (spec.id == null) {
    spec.id = idFields;
  }
  return schema.makeHandler(key, spec);
}

module.exports = function(streamDAO){
  return schema.makeSubHandler(
    'bolus',
    'subType',
    [
      makeHandler(
        'injected',
        {
          schema: {
            value: schema.isNumber,
            insulin: schema.in('novolog', 'humalog')
          }
        }
      ),
      makeHandler(
        'normal',
        {
          schema: {
            normal: schema.isNumber
          },
          transform: function(datum, cb) {
            if (datum.previous == null) {
              return cb(null, datum);
            } else {
              datum.previous._groupId = datum._groupId;
              var previous = schema.attachIds(_.clone(datum.previous), idFields);

              streamDAO.getDatum(previous._id, function(err, prev){
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
      makeHandler(
        'square',
        {
          schema: {
            extended: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThan(0))
          },
          transform: function(datum, cb){
            if (datum.previous == null) {
              return cb(null, datum);
            } else {
              var previous = schema.attachIds(_.clone(datum.previous), idFields);

              streamDAO.getDatum(previous._id, function(err, prev){
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
      makeHandler(
        'dual/square',
        {
          schema: {
            normal: schema.isNumber,
            extended: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThan(0))
          }
        }
      )
    ]
  );
};

module.exports.idFields = idFields;