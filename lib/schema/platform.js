'use strict';

var amoeba = require('amoeba');
var except = amoeba.except;
var misc = require('../misc.js');

var idHashFieldMap = {};

const convertMgToMmol = function (mgValue) {
  const mmolLToMgdLConversionFactor = 18.01559;
  const mmolLToMgdLPrecisionFactor = 100000.0;
  let mmolVal = parseInt(
    (mgValue / mmolLToMgdLConversionFactor) * mmolLToMgdLPrecisionFactor + 0.5
  );
  return mmolVal / mmolLToMgdLPrecisionFactor;
};

exports.registerFieldsForDuplicator = function (type, idHashFields = []) {
  if (idHashFieldMap[type] == null) {
    idHashFieldMap[type] = [
      '_userId',
      'deviceId',
      'time',
      'type',
      ...idHashFields,
    ];
  } else {
    throw except.IAE(
      'Id hash fields for type[%s] already defined[%j], cannot set[%j]',
      type,
      idHashFieldMap[type],
      idHashFields
    );
  }
};

exports.generateHash = function (datum) {
  if (typeof datum === 'string') {
    return datum;
  }
  var idHashFields = idHashFieldMap[datum.type];
  if (!idHashFields) {
    throw except.IAE("Can't generate hash, no fields for type[%s]", datum.type);
  }
  var vals = new Array(idHashFields.length);
  for (var i = 0; i < idHashFields.length; ++i) {
    let val = datum[idHashFields[i]];
    if (val == null) {
      throw except.IAE(
        "Can't generate hash, field[%s] didn't exist on datum of type[%s]",
        idHashFields[i],
        datum.type
      );
    }
    if (idHashFields[i] === 'time') {
      const dateTime = new Date(val);
      // NOTE: platform `time` is being returned minus millis so we need to do the same here
      val = dateTime.toISOString().split('.')[0] + 'Z';
    }
    if (idHashFields[i] === 'value') {
      if (
        datum.type === 'smbg' ||
        datum.type === 'bloodKetone' ||
        datum.type === 'cbg'
      ) {
        // NOTE: platform `value` precision is being used so that the hash will be the same
        if (val.toString().length > 7) {
          val = convertMgToMmol(val);
        }
      }
    }
    vals[i] = String(val);
  }
  return misc.generateHash(vals);
};

// exported for testing
exports.convertMgToMmol = convertMgToMmol;
