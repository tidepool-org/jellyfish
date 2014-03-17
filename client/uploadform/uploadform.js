/** @jsx React.DOM */
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

var React = window.React;
var _ = window._;

var UploadFormGroup = require('./uploadformgroup');

var UploadForm = React.createClass({
  propTypes: {
    disabled: React.PropTypes.bool,
    submitButtonText: React.PropTypes.string,
    onSubmit: React.PropTypes.func
  },

  getInitialState: function() {
    var formValues = this.getInitialFormValues();
    return {
      formValues: formValues
    };
  },

  // Make sure all inputs have a defined form value
  getInitialFormValues: function() {
    var allInputs = this.getAllInputs();
    var formValues = _.reduce(allInputs, function(result, input) {
      result[input.name] = '';
      return result;
    }, {});
    return formValues;
  },

  getAllInputs: function() {
    return _.flatten(_.pluck(this.formGroups, 'inputs'));
  },

  formGroups: [
    {
      title: 'Diasend',
      instructions: [
        'Please enter your Diasend user name and password',
        '(for Animas and Asante pumps).'
      ].join(' '),
      help: [
        'We need your user name and password to fetch your data.',
        'We will ask you this every time.',
        'We will not store your Diasend username or password.'
      ].join(' '),
      inputs: [
        {name: 'diasendUsername', placeholder: 'Username', type: 'text'},
        {name: 'diasendPassword', placeholder: 'Password', type: 'password'},
      ]
    },
    {
      title: 'Dexcom',
      instructions: [
        'Export your data from Dexcom Studio as a tab-delimited file',
        'and upload it here.',
      ].join(' '),
      help: [
        'If you need help with getting your data into Dexcom Studio,',
        'you can try the',
        '<a href="http://www.dexcom.com/faq/dexcom-studio/getting-started"',
        'target="_blank">Dexcom help site</a>.'
      ].join(' '),
      inputs: [
        {name: 'dexcom', type: 'file'}
      ]
    },
    {
      title: 'CareLink',
      instructions: [
        'Please enter your CareLink user name and password',
        '(for Medtronic pumps and CGMs).'
      ].join(' '),
      help: [
        'We need your user name and password to fetch your data.',
        'We will ask you this every time.',
        'We will not store your CareLink username or password.'
      ].join(' '),
      inputs: [
        {name: 'carelinkUsername', placeholder: 'Username', type: 'text'},
        {name: 'carelinkPassword', placeholder: 'Password', type: 'password'},
        {name: 'daysAgo', value: '180', type: 'hidden'}
      ]
    }
  ],
  
  render: function() {
    var formGroups = this.renderFormGroups();
    var submitButton = this.renderSubmitButton();

    /* jshint ignore:start */
    return (
      <form className="upload-form">
        {formGroups}
        {submitButton}
      </form>
    );
    /* jshint ignore:end */
  },

  renderFormGroups: function() {
    return _.map(this.formGroups, this.renderFormGroup);
  },

  renderFormGroup: function(group) {
    /* jshint ignore:start */
    return (
      <UploadFormGroup
        key={group.title}
        title={group.title}
        instructions={group.instructions}
        help={group.help}
        inputs={group.inputs}
        disabled={this.props.disabled}
        onChange={this.handleChange}/>
    );
    /* jshint ignore:end */
  },

  handleChange: function(e) {
    var key = e.target.name;
    var value = e.target.value;
    if (key) {
      var formValues = _.clone(this.state.formValues);
      formValues[key] = value;
      this.setState({formValues: formValues});
    }
  },

  renderSubmitButton: function() {
    var text = this.props.submitButtonText;
    var disabled = this.props.disabled;

    /* jshint ignore:start */
    return (
      <div className="upload-form-action">
        <button
          className="btn btn-primary"
          type="submit"
          disabled={disabled}
          onClick={this.handleSubmit}>{text}</button>
      </div>
    );
    /* jshint ignore:end */
  },

  handleSubmit: function(e) {
    if (e) {
      e.preventDefault();
    }

    var submit = this.props.onSubmit;
    if (submit) {
      var formValues = _.clone(this.state.formValues);
      var formData = this.getFormDataObject();
      submit(formValues, formData);
    }
  },

  // Returns nothing if browser doesn't support `FormData` API
  getFormDataObject: function() {
    var formData;
    if ('FormData' in window) {
      var formEl = this.getDOMNode();
      formData = new FormData(formEl);
    }
    return formData;
  }
});

module.exports = UploadForm;