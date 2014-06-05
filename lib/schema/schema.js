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

exports.and = function and(fns) {
  return function(val) {
    for (var i = 0; i < fns.length; ++i) {
      if (! fns[i](val)) {
        return false;
      }
    }
    return true;
  }
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

exports.convertUnits = function(datum, field) {
  if (datum.units === 'mg/dl') {
    datum.units = 'mg/dL';
  }

  if (datum.units === 'mg/dL') {
    datum[field] = datum[field] / 18.01559;
  }

  return datum;
};

function ensureSchemaFn(type, schema) {
  var keys = Object.keys(schema);

  return function(datum) {
    for (var i = 0; i < keys.length; ++i) {
      try {
        schema[keys[i]](datum[keys[i]])
      } catch (e) {
        if (e.type === 'IllegalArgumentException') {
          throw except.IAE('field[%s] on type[%s] %s', keys[i], type, e.message);
        }
        throw e;
      }
    }
  };
}

exports.makeHandlers = function(spec) {
  var retVal = {};

  var baseChecks = {
    time: exports.validTimestamp,
    timezoneOffset: exports.ifExists(
      exports.and([exports.isNumber, exports.lessThanEq(1440), exports.greaterThanEq(-1440)])
    ),
    deviceId: exports.isString,
    source: exports.isString,
    _active: exports.doesNotExist,
    _sequenceId: exports.doesNotExist
  };

  Object.keys(spec).forEach(function(key) {
    var schemaFn = ensureSchemaFn(key, _.assign({}, baseChecks, spec[key].schema));
    var idFields = spec[key].id;

    if (idFields == null || idFields.length < 1) {
      throw except.ISE('Must specify fields to use to generate the object id on a spec.');
    }

    var transformer = spec[key].transform;
    if (transformer == null) {
      transformer = function(datum, cb) { return cb(null, datum); };
    }

    var decepticon = function(datum, cb) {
      if (datum.time[datum.time.length - 1] !== 'Z') {
        datum.time = new Date(datum.time).toISOString();
      }

      transformer(datum, function(err, newDatum){
        if (err != null) {
          return cb(err);
        }

        var hasher = crypto.createHash('sha1');
        for (var i = 0; i < idFields.length; ++i) {
          hasher.update(String(newDatum[idFields[i]]));
        }
        newDatum._id = base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });

        cb(null, newDatum);
      });
    };

    retVal[key] = function(datum, cb) {
      try {
        schemaFn(datum);
      } catch (e) {
        if (e.type === 'IllegalArgumentException') {
          return cb({ statusCode: 400, message: e.message });
        } else {
          throw e;
        }
      }

      decepticon(datum, cb);
    }
  });

  return retVal;
};

