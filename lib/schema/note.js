/*
 * == BSD2 LICENSE ==
 */

'use strict';

var schema = require('./schema.js');

var idFields = ['type', 'time', 'creatorId', 'text'];
schema.registerIdFields('note', idFields);

module.exports = function(streamDAO){
  return schema.makeHandler('note', {
    schema: {
      shortText: schema.ifExists(schema.isString),
      text: schema.isString,
      creatorId: schema.isString,
      reference: schema.ifExists(schema.or(schema.isObject, schema.isString)),
      displayTime: schema.doesNotExist
    },
    transform: function(datum, cb) {
      if (datum.reference != null) {
        datum.reference = schema.makeId(datum.reference);
        streamDAO.getDatum(datum.reference, datum._groupId, function(err, referee) {
          if (err != null) {
            return cb(err);
          }

          datum.displayTime = datum.time;
          datum.time = referee.time;

          cb(null, datum);
        });
      } else {
        cb(null, datum);
      }
    }
  });
};