/*
 * == BSD2 LICENSE ==
 */

'use strict';

var crypto = require('crypto');

var _ = require('lodash');
var amoeba = require('amoeba');
var base32hex = amoeba.base32hex;
var except = amoeba.except;

exports.validTimestamp = function(val) {
  if (Number.isNaN(Date.parse(val))) {
    throw except.IAE('should be a string in ISO8601 format, got[%j]', val);
  }

  var hasTimezone = true;
  if (val[val.length - 1] === 'Z') {
    hasTimezone = true;
  } else if (val.length < 6) {
    hasTimezone = false;
  } else if (val[val.length - 3] !== ':') {
    hasTimezone = false;
  } else {
    var plusMinus = val[val.length - 6];
    if (! (plusMinus === '+' || plusMinus === '-')) {
      hasTimezone = false;
    }
  }

  if (!hasTimezone) {
    throw except.IAE('should have a timezone offset specified, got[%s]', val);
  }
};

exports.doesNotExist = function(val) {
  if (val != null) {
    throw except.IAE('should not exist, got [%j]', val);
  }
  return true;
};

exports.ifExists = function(fn) {
  return function(val) {
    if (val != null) {
      return fn(val);
    }
    return true;
  }
};

exports.and = function() {
  var fns = arguments;

  return function(val) {
    for (var i = 0; i < fns.length; ++i) {
      fns[i](val);
    }
    return true;
  }
};

exports.or = function() {
  var fns = arguments;

  return function(val) {
    var errors = [];
    for (var i = 0; i < fns.length; ++i) {
      try {
        if (fns[i](val)) {
          return true;
        }
      } catch (e) {
        errors.push(e.message);
      }
    }
    throw except.IAE('should match one of %s', errors);
  }
};

exports.in = function() {
  var acceptableValues = {};
  for (var i = 0; i < arguments.length; ++i) {
    acceptableValues[arguments[i]] = true;
  }

  return function(val) {
    if (acceptableValues[val] == null) {
      throw except.IAE('unknown value[%j]', val);
    }
    return true;
  };
};

exports.isNumber = function(val) {
  if (! Number.isFinite(val)) {
    throw except.IAE('should be a number, got[%j]', val);
  }
  return true;
};

exports.lessThan = function(threshold) {
  return function(val) {
    if (val < threshold) {
      return true;
    }
    throw except.IAE('should be < %s, got[%j]', threshold, val);
  }
};

exports.lessThanEq = function(threshold) {
  return function(val) {
    if (val <= threshold) {
      return true;
    }
    throw except.IAE('should be <= %s, got[%j]', threshold, val);
  }
};

exports.greaterThan = function(threshold) {
  return function(val) {
    if (val > threshold) {
      return true;
    }
    throw except.IAE('should be > %s, got[%j]', threshold, val);
  }
};

exports.greaterThanEq = function(threshold) {
  return function(val) {
    if (val >= threshold) {
      return true;
    }
    throw except.IAE('should be >= %s, got[%j]', threshold, val);
  }
};

exports.isString = function(val) {
  if (typeof(val) !== 'string') {
    throw except.IAE('should be a string, got[%j]', val);
  }
  return true;
};

exports.isObject = function(val) {
  if (typeof(val) !== 'object') {
    throw except.IAE('should be an object, got[%j]', val);
  }
  return true;
};

exports.isObjectWithValueSchema = function(schema){
  return function(val) {
    if (typeof(val) !== 'object') {
      throw except.IAE('should be an object, got[%j]', val);
    }

    Object.keys(val).forEach(function(key){
      exports.ensureSchemaFn(key, schema)(val[key]);
    });

    return true;
  }
};

exports.isArrayWithValueSchema = function(schema){
  return function(val) {
    if (!Array.isArray(val)) {
      throw except.IAE('should be an array, got[%j]', val);
    }

    for (var i = 0; i < val.length; ++i) {
      exports.ensureSchemaFn(String(i), schema)(val[i]);
    }

    return true;
  }
};

exports.normalizeUnitName = function(name) {
  if (name === 'mmol/l') {
    return 'mmol/L';
  }

  if (name === 'mg/dl') {
    return 'mg/dL';
  }

  return name;
};

exports.convertMgToMmol = function(mg) {
  return mg / 18.01559;
};

exports.convertUnits = function(datum, field) {
  datum.units = exports.normalizeUnitName(datum.units);

  if (datum.units === 'mg/dL') {
    datum[field] = exports.convertMgToMmol(datum[field]);
  }

  return datum;
};

exports.ensureSchemaFn = function(type, schema) {
  if (typeof(schema) === 'function') {
    return schema;
  }

  var keys = Object.keys(schema);

  return function(datum) {
    if (datum == null) {
      throw except.IAE('should exist.');
    }

    for (var i = 0; i < keys.length; ++i) {
      try {
        schema[keys[i]](datum[keys[i]])
      } catch (e) {
        if (e.type === 'IllegalArgumentException') {
          throw except.IAE('%s.%s %s', type, keys[i], e.message);
        }
        throw e;
      }
    }
  };
};

exports.generateId = function(datum, fields) {
  var hasher = crypto.createHash('sha1');
  for (var i = 0; i < fields.length; ++i) {
    hasher.update(String(datum[fields[i]]));
  }
  return base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
};

exports.attachIds = function(datum, fields) {
  if (datum.id == null) {
    datum.id = exports.generateId(datum, fields);
  }

  if (datum._id == null) {
    datum._id = exports.generateId(datum, ['id', 'groupId']);
  }

  return datum;
};


var baseChecks = {
  time: exports.validTimestamp,
  timezoneOffset: exports.ifExists(
    exports.and(exports.isNumber, exports.lessThanEq(1440), exports.greaterThanEq(-1440))
  ),
  deviceId: exports.isString,
  source: exports.isString,
  _active: exports.doesNotExist,
  _sequenceId: exports.doesNotExist
};

exports.makeHandler = function(key, spec) {
  var schemaFn = exports.ensureSchemaFn(key, _.assign({}, baseChecks, spec.schema));
  var idFields = spec.id;

  if (idFields == null || idFields.length < 1) {
    throw except.ISE('Must specify fields to use to generate the object id on a spec.');
  }

  var transformer = spec.transform;
  if (transformer == null) {
    transformer = function(datum, cb) { return cb(null, datum); };
  }

  var decepticon = function(datum, cb) {
    if (datum._groupId == null) {
      return cb(new Error('_groupId must be set on a datum'));
    }

    if (datum.time[datum.time.length - 1] !== 'Z') {
      datum.time = new Date(datum.time).toISOString();
    }

    transformer(datum, function(err, newDatum){
      if (err != null) {
        return cb(err);
      }
      cb(null, exports.attachIds(newDatum, idFields));
    });
  };

  var retVal = function (datum, cb) {
    try {
      schemaFn(datum);
    } catch (e) {
      if (e.type === 'IllegalArgumentException') {
        e.statusCode = 400;
      }
      return cb(e);
    }

    decepticon(datum, cb);
  };

  retVal.key = key;

  return retVal;
};

