'use strict';
var JaySchema = require('jayschema');
var jsonSchemas = new JaySchema();

var omhSchemas = require('./omhschemas.js');

/**
This module exposes JSON schemas wrapped using the Jay Schema validator
This is used to validate incoming physical activity & step count objects 
against the Open mHealth schemas. However any JSON schema compatible schema 
can be used and exposed here
**/

// Top level suported schemas from Open mHealth
jsonSchemas.register(omhSchemas['physical-activity-1.2'], 'physical-activity-1.2');
jsonSchemas.register(omhSchemas['step-count-1.x'], 'step-count-1.x');
jsonSchemas.register(omhSchemas['header-1.1'],'header-1.1');

// These are sub-schemas used in the definitions of the top-level schemas
jsonSchemas.register(omhSchemas['activity-name-1.x'], 'activity-name-1.x.json');
jsonSchemas.register(omhSchemas['time-frame-1.x.json'], 'time-frame-1.x.json');
jsonSchemas.register(omhSchemas['length-unit-value-1.x'], 'length-unit-value-1.x.json');
jsonSchemas.register(omhSchemas['time-interval-1.x'], 'time-interval-1.x.json');
jsonSchemas.register(omhSchemas['date-time-1.x'], 'date-time-1.x.json');
jsonSchemas.register(omhSchemas['unit-value-1.x'], 'unit-value-1.x.json');
jsonSchemas.register(omhSchemas['part-of-day-1.x'], 'part-of-day-1.x.json');
jsonSchemas.register(omhSchemas['duration-unit-value-1.x'],'duration-unit-value-1.x.json');
jsonSchemas.register(omhSchemas['schema-id-1.x'],'schema-id-1.x');
jsonSchemas.register(omhSchemas['kcal-unit-value-1.x.json'],'kcal-unit-value-1.x.json');

//register any more JSON Schemas you want to use here

module.exports = jsonSchemas;
