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

The following JSON objects is an example of a Physical Activity object:

{
  "type": "physicalActivity",   <-- The type indicates is a physical activity object

  "time": "2015-10-24T16:17:50.000Z", <-- time that activity took place (ISO String)
  "timezoneOffset":-240,
  "conversionOffset":0,
  "deviceId": "runkeeper-A1234", <-- An ID indicating the device/app the reading came from 
  "uploadId": "0001", <--- An ID indicating the batch of uploads that the activity came from

  "datapoint": {  <-- This describes the physcial activty. Follows the Open mHealth schema for physical activity
        "header":{
          "acquisition_provenance": {
          "source_name": "Runkeeper HealthGraph API", <-- source of the data
          "modality": "sensed", <-- How the data was captured. 'sensed' or 'self-reported' (optional)
          "external_id": "/fitnessActivities/679963655" <-- ID identifying record in source system (optional)
        }
            
        },
        "body": {
          "effective_time_frame": {
          "time_interval": {
            "start_date_time": "2015-10-24T12:17:50-04:00", <-- Date/time that activity started. This usually matches the top level 'time' field
            "duration": {
              "unit": "sec",
              "value": 148.311  <-- how long the activity took place for
            }
          }
        },
        "activity_name": "Running",  <-- Type of activity
        "distance": { <-- Distance of activity (optional)
            "unit": "m",
            "value": 10.3929068646607 
          }
        },
        "kcal_burned": { <-- calories burned (optional)
          "unit": "kcal",
          "value": 7     
        },
        "reported_activity_intensity": "moderate" <-- intensity level of activity as reported by user (optional)
        
      }
}

**/

var idFields = ['type', 'time', 'deviceId'];
schema.registerIdFields('physicalActivity', idFields);

module.exports = schema.makeHandler('physicalActivity', {
  schema: {
    subType: schema.ifExists(schema.isString),
    datapoint: schema.ensureSchemaFn('datapoint',{
                    header: schema.isJsonSchemaValiatedObject('header-1.1'),
                    body: schema.isJsonSchemaValiatedObject('physical-activity-1.2')
                  })
  }
});

