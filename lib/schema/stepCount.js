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

var schema = require('./schema.js');


/**

The following JSON objects is an example of a Step Count object:

{
  "type": "stepCount",   <-- The type indicates is a step count object

  "time": "2015-10-14T04:00:50.000Z", <-- time that step counts took place (ISO String)
  "timezoneOffset":-240,
  "conversionOffset":0,
  "deviceId": "jawbone-A1234", <-- An ID indicating the device/app the reading came from 
  "uploadId": "0001", <--- An ID indicating the batch of uploads that the activity came from

  "datapoint": {  <-- This describes the calculated step count. Follows the Open mHealth schema for step count
        "header":{
          "acquisition_provenance": {
          "source_name": "Jawbone UP API", <-- source of the data
          "modality": "sensed", <-- How the data was captured. 'sensed' or 'self-reported' (optional)
          "external_id": "43t7Tx40joGTZSuJe1H4I8KzpgjxT7a7" <-- ID identifying record in source system (optional)
        }
            
        },
        "body": {
          "effective_time_frame": {
          "time_interval": {
            "start_date_time": "2015-10-14T00:00:50-04:00", <-- Date/time that period started. This usually matches the top level 'time' field
            "end_date_time": "2015-10-14T23:14:51-04:00" <-- Date/time that period ended
          }
        },
        
        "step_count": 7851 <-- number of steps taken during period
        
      }
}
}
**/



var idFields = ['type', 'time', 'deviceId'];
schema.registerIdFields('stepCount', idFields);

module.exports = schema.makeHandler('stepCount', {
  schema: {
    subType: schema.ifExists(schema.isString),
    datapoint: schema.ensureSchemaFn('datapoint',{
                    header: schema.isJsonSchemaValiatedObject('header-1.1'),
                    body: schema.isJsonSchemaValiatedObject('step-count-1.x')
                  })
  }
});


/**
var acquisition_provenance = schema.isObjectWithValueSchema({
								source_name: schema.isString,
								modaility: schema.ifExists(schema.isString),
								external_id: schema.ifExists(schema.isString)

})
**/
/**
"acquisition_provenance": {
          "source_name": "Runkeeper HealthGraph API",
          "modality": "sensed",
          "external_id": "/fitnessActivities/679963655"
        },
**/