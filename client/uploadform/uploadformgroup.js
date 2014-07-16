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

var timezones = require('../timezone/timezones');
var getTimezoneDefaultValue = require('../timezone/timezonedetect');

var UploadFormGroup = React.createClass({
  propTypes: {
    title: React.PropTypes.string.isRequired,
    instructions: React.PropTypes.string,
    // Help can be an HTML string
    help: React.PropTypes.string,
    inputs: React.PropTypes.array,
    disabled: React.PropTypes.bool,
    onChange: React.PropTypes.func
  },

  render: function() {
    var instructions = this.renderInstructions();
    var help = this.renderHelp();
    var inputs = this.renderInputs();

    /* jshint ignore:start */
    return (
      <div className="upload-form-group">
        <div className="upload-form-group-title">{this.props.title}</div>
        <div className="upload-form-group-content">
          {instructions}
          {help}
          {inputs}
        </div>
      </div>
    );
    /* jshint ignore:end */
  },

  renderInstructions: function() {
    var text = this.props.instructions;

    if (text) {
      /* jshint ignore:start */
      return (
        <div className="upload-form-group-instructions">{text}</div>
      );
      /* jshint ignore:end */
    }

    return null;
  },

  renderHelp: function() {
    var text = this.props.help;

    if (text) {
      /* jshint ignore:start */
      return (
        <div
          className="upload-form-group-help"
          dangerouslySetInnerHTML={{__html: text}}></div>
      );
      /* jshint ignore:end */
    }

    return null;
  },

  renderInputs: function() {
    var inputs = this.props.inputs;
    if (inputs.length) {
      return _.map(inputs, this.renderInput);
    }

    return null;
  },

  renderInput: function(input) {
    if (input.type === 'timezone') {
      return this.renderTimezoneSelector({
        name: input.name,
        label: input.label,
        defaultValue: getTimezoneDefaultValue()
      });
    }

    return (
      /* jshint ignore:start */
      <input
        key={input.name}
        type={input.type}
        className="upload-form-group-input form-control"
        id={input.name}
        name={input.name}
        value={input.value}
        placeholder={input.placeholder}
        disabled={this.props.disabled}
        onChange={this.props.onChange}/>
      /* jshint ignore:end */
    );
  },

  renderTimezoneSelector: function(options) {
    var inputName = options.name;
    var label;
    if (options.label) {
      /* jshint ignore:start */
      label = <label htmlFor={inputName}>{options.label}</label>
      /* jshint ignore:end */
    }

    var selectOptions = _.map(timezones, function(timezone) {
      /* jshint ignore:start */
      return <option value={timezone.name}>{timezone.label}</option>;
      /* jshint ignore:end */
    });

    /* jshint ignore:start */
    return (
      <div key={inputName}>
        {label}
        <select
          className="upload-form-group-input form-control"
          id={inputName}
          name={inputName}
          defaultValue={options.defaultValue}
          disabled={this.props.disabled}
          onChange={this.props.onChange}>
          {selectOptions}
        </select>
      </div>
    );
    /* jshint ignore:end */
  }
});

module.exports = UploadFormGroup;
