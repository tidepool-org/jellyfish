/**

This file contains the JSON schema definitions for the Open mHealth Schemas that Jellyfish
uses to describe objects such as physical activity and step count.
These schemas can be found here: 
www.openmhealth.org/schema/omh

The objects below are downloaded from there and then exported as a module so they can be 
reused in Jellyfish

**/

var physical_activity = {
    "id":"physical-activity-1.2",
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema represents a single episode of physical activity.",
    "type": "object",
    "references": [
        {
            "description": "The SNOMED code represents Physical activity (observable entity)",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/68130003"
        }
    ],
    "definitions": {
        "activity_name": {
            "$ref": "activity-name-1.x.json"
        },
        "length_unit_value": {
            "$ref": "length-unit-value-1.x.json"
        },
        "kcal_unit_value": {
            "$ref": "kcal-unit-value-1.x.json"
        },
        "time_frame": {
            "$ref": "time-frame-1.x.json"
        }
    },

    "properties": {
        "activity_name": {
            "$ref": "#/definitions/activity_name"
        },
        "effective_time_frame": {
            "$ref": "#/definitions/time_frame"
        },
        "distance": {
            "description": "The distance covered, if applicable.",
            "$ref": "#/definitions/length_unit_value"
        },
        "kcal_burned": {
            "$ref": "#/definitions/kcal_unit_value"
        },
        "reported_activity_intensity": {
            "description": "Self-reported intensity of the activity performed.",
            "type": "string",
            "enum": ["light", "moderate", "vigorous"]
        },
        "met_value": {
            "description": "Metabolic Equivalent of Task value for the activity",
            "type": "number"
        }
    },

    "required": ["activity_name"]
}

var activity_name = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "The name(s) of the physical activity(ies) in which the person is engaged. It is recommended that the activity name be drawn from the CDC guidelines to facilitate mapping to standard energy expenditure values (METs)",

    "references": [
        {
            "description": "The SNOMED code represents Activity",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/257733005"
        },
        {
             "description": "CDC guidelines on standard energy expenditure values (METs).",
             "url": "http://www.startwalkingnow.org/documents/PA_Intensity_table_2_1.pdf"
        }
    ],
    "type": "string"
}

var time_frame = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema describes a time frame as a point in time or a time interval.",

    "type": "object",
    "references": [
        {
            "description": "The SNOMED codes represent Time frame (qualifier value).",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/7389001"
        }
    ],

    "definitions": {
        "date_time": {
            "$ref": "date-time-1.x.json"
        },

        "time_interval": {
            "$ref": "time-interval-1.x.json"
        }
    },

    "oneOf": [
        {
            "properties": {
                "date_time": {
                    "$ref": "#/definitions/date_time"
                }
            },
            "required": [ "date_time"]
        },
        {
            "properties": {
                "time_interval": {
                    "$ref": "#/definitions/time_interval"
                }
            },
            "required": [ "time_interval"]
        }
    ]
}

var length_unit_value = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema represents a length or a distance.",
    "type": "object",

    "references": [
        {
            "description": "The SNOMED code represents Length",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/410668003"
        }
    ],

    "allOf": [
        {
            "$ref": "unit-value-1.x.json"
        },
        {
            "properties": {
                "unit": {
                    "references": [
                        {
                            "description": "The unit of measure of the element. Basic unit is meter (m) [ http://unitsofmeasure.org/ucum.html#para-28 ]. Allowed values are drawn from the SI Length Units and English Length Units Common Synonyms (non-UCUM). The valid UCUM code is different for inch ([in_i]), foot ([ft_i]), yard ([yd_i]) and mile ([mi_i]).",
                            "url": "http://download.hl7.de/documents/ucum/ucumdata.html"
                        }
                    ],
                    "enum": [
                        "fm",
                        "pm",
                        "nm",
                        "um",
                        "mm",
                        "cm",
                        "m",
                        "km",
                        "in",
                        "ft",
                        "yd",
                        "mi"
                    ]
                }
            }
        }
    ]
}

var time_interval = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema describes an interval of time. In the absence of a precise start and/or end time, the time interval can be described as a date + a part of the day (morning, afternoon, evening, night). No commitments are made as to whether the start or end time point itself is included in the interval (i.e., whether the defined interval includes the boundary point(s) or not).",
    "type": "object",

    "references": [
        {
            "description": "The NCIT codes represent Timespan (synonym: time interval).",
            "url": "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl#C68594"
        }
    ],

    "definitions": {
        "date_time": {
            "$ref": "date-time-1.x.json"
        },
        "duration-unit-value": {
            "$ref": "duration-unit-value-1.x.json"
        },
        "full_date": {
            "type": "string",
            "references": [
                {
                    "description": "This schema represents a date. See RFC 3339 5.6 for details.",
                    "url": "http://tools.ietf.org/html/rfc3339"
                }
            ],
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
        },
        "part_of_day": {
            "$ref": "part-of-day-1.x.json"
        }
    },

    "oneOf": [
        {
            "properties": {
                "start_date_time": {
                    "$ref": "#/definitions/date_time"
                },
                "duration": {
                    "$ref": "#/definitions/duration-unit-value"
                }
            },
            "required": ["start_date_time", "duration"]
        },
        {
            "properties": {
                "end_date_time": {
                    "$ref": "#/definitions/date_time"
                },
                "duration": {
                    "$ref": "#/definitions/duration-unit-value"
                }
            },
            "required": ["end_date_time", "duration"]
        },
        {
            "properties": {
                "start_date_time": {
                    "$ref": "#/definitions/date_time"
                },
                "end_date_time": {
                    "$ref": "#/definitions/date_time"
                }
            },
            "required": ["start_date_time", "end_date_time"]
        },
        {
            "properties": {
                "date": {
                    "$ref": "#/definitions/full_date"
                },
                "part_of_day": {
                    "$ref": "#/definitions/part_of_day"
                }
            },
            "required": ["date", "part_of_day"]
        }
    ]
}

var date_time = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "description": "This schema represents a point in time (ISO8601). If a timezone is not included, the timezone is assumed to be UTC.", 
    "type": "string",
    "references": [
        {
            "description": "Reference RFC 3339 5.6 for details.",
            "url": "http://tools.ietf.org/html/rfc3339#section-5.6"
        },
        {
            "description": "The SNOMED codes represent Single point in time (qualifier value).",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/123029007"
        }
    ],
    "format": "date-time"
}

var unit_value = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema represents a numerical value with a unit of measure.",

    "type": "object",

    "properties": {
        "value": {
            "description": "The numeric value of the element.",
            "type": "number"
        },
        "unit": {
            "references": [
                {
                    "description": "The unit of measure of the element. Allowed values are drawn from the Common synonyms (non-UCUM) column of [subset of] UCUM, SI and English units. ",
                    "url": "http://download.hl7.de/documents/ucum/ucumdata.html"
                }
            ],
            "type": "string"
        }
    },
    "required": [
        "value",
        "unit"
    ]
}

var part_of_day = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "The period of time in which a day is commonly divided.",

    "type": "string",

    "references": [
        {
            "value": "morning",
            "description": "The SNOMED code represents morning (temporal qualifier)",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/73775008"
        },
        {
            "value": "afternoon",
            "description": "The SNOMED code represents afternoon (temporal qualifier)",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/422133006"
        },
        {
            "value": "evening",
            "description": "The SNOMED code represents evening (temporal qualifier)",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/3157002"
        },
        {
            "value": "night",
            "description": "The SNOMED code represents night time (temporal qualifier)",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/2546009"
        }
    ],
    "enum": ["morning", "afternoon", "evening", "night"]
}

var duration_unit_value = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema represents a duration or length of time.",

    "type": "object",

    "references": [
        {
            "description": "The SNOMED code represents Duration (qualifier value)",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/103335007"
        }
    ],

    "allOf": [
        {
            "$ref": "unit-value-1.x.json"
        },
        {
            "properties": {
                "unit": {
                    "references": [
                        {
                            "description": "The unit of measure of the element. Basic unit is second (s). Allowed values are drawn from the Time Units Common Synonyms (non-UCUM). The valid UCUM code is different for second (s), month (mo) and year (a).",
                            "url": "http://download.hl7.de/documents/ucum/ucumdata.html"
                        }
                    ],
                    "enum": [
                        "ps",
                        "ns",
                        "us",
                        "ms",
                        "sec",
                        "min",
                        "h",
                        "d",
                        "wk",
                        "Mo",
                        "yr"
                    ]
                }
            }
        }
    ]
}

var omh_header = {
    "id":"header-1.1",
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema represents the header of a data transaction.",
    "type": "object",

    "definitions": {
        "date_time": {
            "$ref": "date-time-1.x.json"
        },
        "schema_id": {
            "$ref": "schema-id-1.x.json"
        }
    },

    "properties": {
        "id": {
            "description": "The identifier of this data point. We strongly recommend this to be a globally unique value.",
            "type": "string"
        },
        "creation_date_time": {
            "description": "The date time this data point was created.",
            "$ref": "#/definitions/date_time"
        },
        "schema_id": {
            "description": "The schema identifier of the body of the data point.",
            "$ref": "#/definitions/schema_id"
        },
        "acquisition_provenance": {
            "type": "object",
            "properties": {
                "source_name": {
                    "description": "The name of the source of the data.",
                    "type": "string"
                },
                "source_creation_date_time": {
                    "description": "The date time (timestamp) of data creation at the source.",
                    "$ref": "#/definitions/date_time"
                },
                "modality": {
                    "description": "The modality whereby the measure is obtained.",
                    "type": "string",
                    "enum": ["sensed","self-reported"]
                }
            },
            "required": ["source_name"]
        },
        "user_id": {
            "description": "The user this data point belongs to.",
            "type": "string"
        }
    },

    "required": [
        //"id",
        //"creation_date_time",
        //"schema_id",
        "acquisition_provenance"
    ]
}

schema_id = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema represents a JSON Schema identifier.",

    "type": "object",

    "properties": {
        "namespace": {
            "description": "The namespace of the schema. A namespace serves to disambiguate schemas with conflicting names.",
            "type": "string"
        },
        "name": {
            "description": "The name of the schema.",
            "type": "string"
        },
        "version": {
            "description": "The version of the schema, e.g. 1.0.",
            "type": "string"
        }
    },
    "required": [
        "namespace",
        "name",
        "version"
    ]
}


step_count = {
    "id":"step-count-1.x",
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema represents a single measurement of number of steps. The ability to represent descriptive statistics (e.g., mean, median) will be added shortly. ",

    "type": "object",
    "references": [
        {
            "description": "The LOINC code refers to Number of steps in unspecified time Pedometer",
            "url": "http://purl.bioontology.org/ontology/LNC/55423-8"
        }
    ],

    "definitions": {
        "time_frame": {
            "$ref": "time-frame-1.x.json"
        }
    },

    "properties": {
        "step_count": {
            "type": "number"
        },
        "effective_time_frame": {
            "$ref": "#/definitions/time_frame"
        }
    },

    "required": ["step_count"]
}

kcal_unit_value = {
    "$schema": "http://json-schema.org/draft-04/schema#",

    "description": "This schema represents an amount (value) of kilocalories (unit of measure).",

    "type": "object",

    "references": [
        {
            "description": "The SNOMED code represents kilocalorie (kcal)",
            "url": "http://purl.bioontology.org/ontology/SNOMEDCT/258791007"
        }
    ],
    "allOf": [
        {
            "$ref": "unit-value-1.x.json"
        },
        {
            "properties": {
                "unit": {
                    "references": [
                        {
                            "description": "The unit of measure of the element. The allowed value is kcal. This is not a standard (see http://unitsofmeasure.org/ucum.html#para-43), but it is the one commonly and widely used.",
                            "url": "http://unitsofmeasure.org/ucum.html#datyp2apdxatblxmp"
                        }
                    ],
                    "enum": ["kcal"]
                }
            }
        }
    ]
}

module.exports = {
    "physical-activity-1.2":physical_activity,
    "activity-name-1.x":activity_name,
    "time-frame-1.x.json": time_frame,
    "length-unit-value-1.x": length_unit_value,
    "time-interval-1.x":time_interval,
    "date-time-1.x":date_time,
    "unit-value-1.x":unit_value,
    "part-of-day-1.x":part_of_day,
    "duration-unit-value-1.x":duration_unit_value,
    "header-1.1":omh_header,
    "schema-id-1.x":schema_id,
    "step-count-1.x":step_count,
    "kcal-unit-value-1.x.json":kcal_unit_value
}

