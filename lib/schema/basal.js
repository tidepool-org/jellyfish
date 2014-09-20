/*
 * == BSD2 LICENSE ==
 */

var util = require('util');

var _ = require('lodash');

var schema = require('./schema.js');

var idFields = ['type', 'deliveryType', 'deviceId', 'time'];
schema.registerIdFields('basal', idFields);

var mismatchedSeries = 'basal/mismatched-series';

function adjustDuration(curr, prev) {
  var actualDuration = Date.parse(curr.time) - Date.parse(prev.time);
  return _.assign({}, prev, { duration: actualDuration, expectedDuration: prev.duration });
}

module.exports = function(streamDAO){
  function updatePreviousDuration(datum, cb) {
    var eventsToStore = [];
    function done() {
      eventsToStore.push(_.omit(datum, 'previous'));
      cb(null, eventsToStore);
    }

    function annotateDatumBefore() {
      streamDAO.getDatumBefore(datum, function(err, disjointPrev){
        if (err != null) {
          return cb(err);
        }

        if (disjointPrev != null) {
          var annotate = true;
          if (disjointPrev.annotations != null) {
            for (var i = 0; i < disjointPrev.annotations.length; ++i) {
              if (disjointPrev.annotations[i].code === mismatchedSeries) {
                annotate = false;
              }
            }
          }

          if (annotate) {
            eventsToStore.push(schema.annotateEvent(
              adjustDuration(datum, disjointPrev),
              { code: mismatchedSeries, nextId: schema.generateId(datum, idFields) }
            ));
          }
        }
        done();
      });
    }


    if (datum.previous != null) {
      var prevId = schema.generateId(datum.previous, idFields);

      streamDAO.getDatum(prevId, datum._groupId, function(err, actualPrev){
        if (err != null) {
          return cb(err);
        }

        if (actualPrev != null) {
          var adjustedPrev = adjustDuration(datum, actualPrev);
          if (adjustedPrev.duration !== actualPrev.duration) {
            eventsToStore.push(adjustedPrev);
          }
          done();
        } else {
          annotateDatumBefore();
        }
      });
    } else {
      annotateDatumBefore();
    }
  }

  return schema.makeSubHandler(
    'basal',
    'deliveryType',
    [
      schema.makeHandler(
        'injected',
        {
          schema: {
            value: schema.isNumber,
            duration: schema.and(schema.isNumber, schema.greaterThan(0)),
            insulin: schema.in('levemir', 'lantus')
          }
        }
      ),
      schema.makeHandler(
        'scheduled',
        {
          schema: {
            scheduleName: schema.isString,
            rate: schema.isNumber,
            duration: schema.ifExists(schema.and(schema.isNumber, schema.greaterThan(0))),
            previous: schema.ifExists(schema.or(schema.isObject, schema.isString)),
            suppressed: schema.ifExists(schema.isObject)
          },
          transform: updatePreviousDuration
        }
      ),
      schema.makeHandler(
        'temp',
        {
          schema: {
            rate: schema.ifExists(schema.isNumber),
            percent: schema.ifExists(schema.and(schema.isNumber, schema.greaterThanEq(0))),
            duration: schema.and(schema.isNumber, schema.greaterThan(0)),
            previous: schema.ifExists(schema.or(schema.isObject, schema.isString)),
            suppressed: schema.ifExists(schema.isObject)
          },
          transform: function(datum, cb){
            if (datum.rate == null && datum.percent != null && datum.suppressed != null) {
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
