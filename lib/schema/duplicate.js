'use strict';

var amoeba = require('amoeba');
var except = amoeba.except;
var misc = require('../misc.js');

var idHashFieldMap = {};

exports.registerFieldsForDuplicator = function (type, idHashFields) {
  let all = ['_userId', 'deviceId', 'time', 'type'];
  if (idHashFields && idHashFields.length > 0) {
    all = all.push(...idHashFields);
  }
  if (idHashFieldMap[type] == null) {
    idHashFieldMap[type] = all;
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
    return '';
  }

  var vals = new Array(idHashFields.length);
  for (var i = 0; i < idHashFields.length; ++i) {
    vals[i] = datum[idHashFields[i]];
    if (vals[i] == null) {
      throw except.IAE(
        "Can't generate hash, field[%s] didn't exist on datum of type[%s]",
        idHashFields[i],
        datum.type
      );
    }
  }
  return misc.generateHash(vals);
};
