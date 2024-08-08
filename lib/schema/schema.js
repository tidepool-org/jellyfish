/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');
var amoeba = require('amoeba');
var semver = require('semver');
var except = amoeba.except;
var util = require('util');

var log = require('../log.js')('schema.js');

var misc = require('../misc.js');

exports.validDeviceTime = function(val) {
  if (!/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)$/.test(val)) {
    throw except.IAE('should be a deviceTime in YYYY-MM-DDThh:mm:ss format, got[%j]', val);
  }
  if (Number.isNaN(Date.parse(val))) {
    throw except.IAE('should be a valid Date string, got[%j]', val);
  }
};

exports.validTimestamp = function(val) {
  if (Number.isNaN(Date.parse(val))) {
    throw except.IAE('should be a valid Date string in ISO8601 format, got[%j]', val);
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

exports.isValidVersion = function(version, minExpectedVersion){
  return semver.gte(version,minExpectedVersion);
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
  };
};

exports.and = function() {
  var fns = arguments;

  return function(val) {
    for (var i = 0; i < fns.length; ++i) {
      fns[i](val);
    }
    return true;
  };
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
    throw except.IAE('should match one of %j', errors);
  };
};

exports.in = function() {
  var acceptableValues = {};
  function addValue(key) {
    acceptableValues[key] = true;
  }
  for (var i = 0; i < arguments.length; ++i) {
    if (Array.isArray(arguments[i])) {
      arguments[i].forEach(addValue);
    } else {
      acceptableValues[arguments[i]] = true;
    }
  }

  return function(val) {
    if (acceptableValues[val] == null) {
      throw except.IAE('unknown value[%j]', val);
    }
    return true;
  };
};

exports.isBoolean = function(val) {
  if (typeof val !== 'boolean') {
    throw except.IAE('should be a boolean, got[%j]', val);
  }
  return true;
};

exports.isNumber = function(val) {
  if (! _.isNumber(val) || ! _.isFinite(val)) {
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
  };
};

exports.lessThanEq = function(threshold) {
  return function(val) {
    if (val <= threshold) {
      return true;
    }
    throw except.IAE('should be <= %s, got[%j]', threshold, val);
  };
};

exports.greaterThan = function(threshold) {
  return function(val) {
    if (val > threshold) {
      return true;
    }
    throw except.IAE('should be > %s, got[%j]', threshold, val);
  };
};

exports.greaterThanEq = function(threshold) {
  return function(val) {
    if (val >= threshold) {
      return true;
    }
    throw except.IAE('should be >= %s, got[%j]', threshold, val);
  };
};

exports.isString = function(val) {
  if (typeof(val) !== 'string') {
    throw except.IAE('should be a string, got[%j]', val);
  }
  return true;
};

exports.isStringOfMaxLength = function(maxLength) {
  return function(val) {
    if (exports.isString && val.length <= maxLength) {
      return true;
    }
    throw except.IAE('should be string of length <= %s, got[%j]', maxLength, val.length);
  };
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
  };
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
  };
};

exports.requireXOR = function(datum, field1, field2) {
  if ((datum[field1] == null && datum[field2] == null) || (datum[field1] != null && datum[field2] != null)) {
    throw except.IAE('should contain either %s or %s', field1, field2);
  }
  return true;
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

exports.convertUnits = function(datum) {
var fields = Array.prototype.slice.call(arguments, 1);
    var normalUnits = exports.normalizeUnitName(datum.units);

  for (var i = 0; i < fields.length; ++i) {
    var field = fields[i];

    if (normalUnits === 'mg/dL' && datum[field] != null) {
      datum[field] = exports.convertMgToMmol(datum[field]);
    }
  }

  if (normalUnits != null) {
    datum.units = 'mmol/L';
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
        schema[keys[i]](datum[keys[i]]);
      } catch (e) {
        if (e.type === 'IllegalArgumentException') {
          throw except.IAE('%s.%s %s', type, keys[i], e.message);
        }
        throw e;
      }
    }
    return true;
  };
};

/**
 * Adds an annotation to an event.
 *
 * @param event the event
 * @param ann the opaque string code for the annotation to add, or the annotation object itself
 */
exports.annotateEvent = function(event, ann) {
  event = _.clone(event);
  if (event.annotations == null) {
    event.annotations = [];
  }

  var annotation = typeof(ann) === 'string' ? { code: ann } : ann;
  var exists = false;
  for (var i = 0; i < event.annotations.length; ++i) {
    if (_.isEqual(event.annotations[i], annotation)) {
      exists = true;
      break;
    }
  }

  if (! exists) {
    event.annotations.push(annotation);
  }

  return event;
};

/**
 * Removes an annotation from an event.  If this leaves the annotations array empty, removes the annotations
 * field entirely.
 *
 * @param event the event to un-annotate
 * @param ann string, the annotation code to remove
 */
exports.removeAnnotation = function(event, ann) {
  if (event.annotations == null) {
    return event;
  }

  event = _.clone(event);

  event.annotations = event.annotations.filter(function(e) {
    return e.code !== ann;
  });

  if (event.annotations.length === 0) {
    delete event.annotations;
  }

  return event;
};

var baseChecks = {
  deviceTime: exports.ifExists(exports.validDeviceTime),
  time: exports.validTimestamp,
  timezoneOffset: exports.ifExists(exports.isNumber),
  conversionOffset: exports.ifExists(exports.isNumber),
  clockDriftOffset: exports.ifExists(exports.isNumber),
  deviceId: exports.isString,
  uploadId: exports.isString,
  _active: exports.doesNotExist,
  _version: exports.doesNotExist,
};

exports.makeHandler = function(key, spec) {
  var schemaFn = exports.ensureSchemaFn(key, _.assign({}, baseChecks, spec.schema));

  var transformer = spec.transform;
  if (transformer == null) {
    transformer = function(datum, cb) { return cb(null, datum); };
  }

  function attachId(data, fields) {
    if (! Array.isArray(data)) {
      data = [data];
    }

    for (var i = 0; i < data.length; ++i) {
      var datum = data[i];
      if (datum.id == null) {
        datum.id = exports.makeId(datum);
        if (datum.type == 'smbg') {
          log.info('Jellyfish SMBG attachId ID ', datum.id);
        }
      }
    }

    return data.length === 1 ? data[0] : data;
  }

  /*
    This function is wrapping the incoming "transformer" callback and doing some extra work. So,
    it is "deceptive" in that it is "changing" the behavior when the callback is called. And the
    noun form of "deceptive", I decided, is "decepticon".  It's also a bonus that "decepticon" is
    a thing from transformers, 'cause it's nice when things line up like that.
   */
  function decepticon(datum, cb) {
    if (datum._userId == null) {
      return cb(new Error('_userId must be set on a datum'));
    }
    if (datum._groupId == null) {
      return cb(new Error('_groupId must be set on a datum'));
    }

    if (datum.time[datum.time.length - 1] !== 'Z') {
      datum.time = new Date(datum.time).toISOString();
    }

    try {
      transformer(datum, function(err, newDatum){
        if (err != null) {
          return cb(err);
        }
        var withId = attachId(newDatum);

        // Swap out cb so that we don't call it again if it throws out an error
        var theCallback = cb;
        cb = function(err) { if (err != null) { throw err; } };
        theCallback(null, withId);
      });
    } catch (e) {
      if (e.type === 'IllegalArgumentException') {
        e.statusCode = 400;
      }
      return cb(e);
    }
  }

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

exports.makeSubHandler = function(value, key, subHandlersArray) {
  var subHandlers = {};
  for (var i = 0; i < subHandlersArray.length; ++i) {
    subHandlers[subHandlersArray[i].key] = subHandlersArray[i];
  }
  var knownTypes = Object.keys(subHandlers);

  var retVal = function (datum, cb) {
    var type = datum[key];
    var subHandler = subHandlers[type];
    if (subHandler == null) {
      return cb(
        { statusCode: 400, message: util.format('unknown %s[%s], known types are [%s]', key, type, knownTypes) }
      );
    }

    subHandler(datum, cb);
  };

  retVal.key = value;

  return  retVal;
};

var idFieldMap = {};

exports.registerIdFields = function(type, idFields) {
  if (idFieldMap[type] == null) {
    idFieldMap[type] = idFields;
  } else {
    throw except.IAE('Id fields for type[%s] already defined[%j], cannot set[%j]', type, idFieldMap[type], idFields);
  }
};

exports.idFields = function(type) {
  var retVal = idFieldMap[type];
  if (retVal == null) {
    throw except.IAE('No known idFields for type[%s]', type);
  }
  return retVal;
};

exports.generateId = function(datum, fields) {
  if (typeof(datum) === 'string') {
    return datum;
  }

  var vals = new Array(fields.length);
  for (var i = 0; i < fields.length; ++i) {
    vals[i] = datum[fields[i]];
    if (vals[i] == null) {
      throw except.IAE('Can\'t generate id, field[%s] didn\'t exist on datum of type[%s]', fields[i], datum.type);
    }
  }

  if (datum.type == 'smbg') {
    log.info('Jellyfish SMBG generateId vals ',vals);
    log.info('Jellyfish SMBG generateId ID for vals ',misc.generateId(vals, true));
  }

  return misc.generateId(vals);
};

exports.makeId = function(datum) {
  if (typeof(datum) === 'string') {
    return datum;
  }

  var type = datum.type;
  var idFields = idFieldMap[type];

  if (idFields == null) {
    throw except.IAE('No known idFields for type[%s]', type);
  }



  return exports.generateId(datum, idFields);
};
