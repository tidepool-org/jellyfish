/*
 * == BSD2 LICENSE ==
 */

'use strict';

var _ = require('lodash');
var expect = require('salinity').expect;

var helper = require('./schemaTestHelper.js');

var goodObject = {
  type: 'cbg',
  time: '2014-01-01T01:00:00.000Z',
  timezoneOffset: 120,
  deviceId: 'test',
  source: 'manual',
  value: 1.12,
  isig: 24.37,
  _groupId: 'g'
};

describe('schema/cbg.js', function(){
  describe('value', function(){
    helper.rejectIfAbsent(goodObject, 'value');
    helper.expectNumericalField(goodObject, 'value');

    it('converts "mmol/l" to "mmol/L"', function(done){
      helper.run(_.assign({}, goodObject, {value: 80, units: 'mmol/l'}), function(err, val){
        expect(val.units).equals('mmol/L');
        expect(val.value).equals(80);
        done(err);
      });
    });

    it('converts units from mg/dL to mmol/L', function(done){
      helper.run(_.assign({}, goodObject, {value: 80, units: 'mg/dL'}), function(err, val){
        expect(val.units).equals('mg/dL');
        expect(val.value).equals(4.440598392836427);
        done(err);
      });
    });

    it('converts units from mg/dl to mmol/L', function(done){
      helper.run(_.assign({}, goodObject, {value: 80, units: 'mg/dl'}), function(err, val){
        expect(val.units).equals('mg/dL');
        expect(val.value).equals(4.440598392836427);
        done(err);
      });
    });
  });

  describe('isig', function(){
    helper.okIfAbsent(goodObject, 'isig');
    helper.expectNumericalField(goodObject, 'isig');
  });

  helper.testCommonFields(goodObject);
});