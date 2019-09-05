import * as d3 from 'd3';

import {BaseMixin} from '../base/base-mixin';

const SPAN_CLASS = 'number-display';

/**
 * A display of a single numeric value.
 *
 * Unlike other charts, you do not need to set a dimension. Instead a group object must be provided and
 * a valueAccessor that returns a single value.
 *
 * If the group is a {@link https://github.com/crossfilter/crossfilter/wiki/API-Reference#crossfilter_groupAll groupAll}
 * then its `.value()` will be displayed. This is the recommended usage.
 *
 * However, if it is given an ordinary group, the `numberDisplay` will show the last bin's value, after
 * sorting with the {@link https://dc-js.github.io/dc.js/docs/html/dc.baseMixin.html#ordering__anchor ordering}
 * function. `numberDisplay` defaults the `ordering` function to sorting by value, so this will display
 * the largest value if the values are numeric.
 * @class numberDisplay
 * @memberof dc
 * @mixes dc.baseMixin
 * @example
 * // create a number display under #chart-container1 element using the default global chart group
 * var display1 = dc.numberDisplay('#chart-container1');
 * @param {String|node|d3.selection} parent - Any valid
 * {@link https://github.com/d3/d3-selection/blob/master/README.md#select d3 single selector} specifying
 * a dom block element such as a div; or a dom element or d3 selection.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {dc.numberDisplay}
 */
export class NumberDisplay extends BaseMixin {
    constructor (parent, chartGroup) {
        super();

        this._formatNumber = d3.format('.2s');
        this._html = {one: '', some: '', none: ''};
        this._lastValue = undefined;

        // dimension not required
        this._mandatoryAttributes(['group']);

        // default to ordering by value, to emulate old group.top(1) behavior when multiple groups
        this.ordering(kv => kv.value);

        this.data(group => {
            const valObj = group.value ? group.value() : this._maxBin(group.all());
            return this.valueAccessor()(valObj);
        });

        this.transitionDuration(250); // good default
        this.transitionDelay(0);

        this.anchor(parent, chartGroup);
    }

    /**
     * Gets or sets an optional object specifying HTML templates to use depending on the number
     * displayed.  The text `%number` will be replaced with the current value.
     * - one: HTML template to use if the number is 1
     * - zero: HTML template to use if the number is 0
     * - some: HTML template to use otherwise
     * @method html
     * @memberof dc.numberDisplay
     * @instance
     * @example
     * numberWidget.html({
     *      one:'%number record',
     *      some:'%number records',
     *      none:'no records'})
     * @param {{one:String, some:String, none:String}} [html={one: '', some: '', none: ''}]
     * @returns {{one:String, some:String, none:String}|dc.numberDisplay}
     */
    html (html) {
        if (!arguments.length) {
            return this._html;
        }
        if (html.none) {
            this._html.none = html.none;//if none available
        } else if (html.one) {
            this._html.none = html.one;//if none not available use one
        } else if (html.some) {
            this._html.none = html.some;//if none and one not available use some
        }
        if (html.one) {
            this._html.one = html.one;//if one available
        } else if (html.some) {
            this._html.one = html.some;//if one not available use some
        }
        if (html.some) {
            this._html.some = html.some;//if some available
        } else if (html.one) {
            this._html.some = html.one;//if some not available use one
        }
        return this;
    }

    /**
     * Calculate and return the underlying value of the display.
     * @method value
     * @memberof dc.numberDisplay
     * @instance
     * @returns {Number}
     */
    value () {
        return this.data();
    }

    _maxBin (all) {
        if (!all.length) {
            return null;
        }
        const sorted = this._computeOrderedGroups(all);
        return sorted[sorted.length - 1];
    }

    _doRender () {
        const newValue = this.value();
        let span = this.selectAll('.' + SPAN_CLASS);

        if (span.empty()) {
            span = span.data([0])
                .enter()
                .append('span')
                .attr('class', SPAN_CLASS)
                .merge(span);
        }

        {
            const self = this;
            span.transition()
                .duration(self.transitionDuration())
                .delay(self.transitionDelay())
                .ease(d3.easeQuad)
                .tween('text', function () {
                    // [XA] don't try and interpolate from Infinity, else this breaks.
                    const interpStart = isFinite(self._lastValue) ? self._lastValue : 0;
                    const interp = d3.interpolateNumber(interpStart || 0, newValue);
                    self._lastValue = newValue;

                    // need to save it in D3v4
                    const node = this;
                    return t => {
                        let html = null;
                        const num = self.formatNumber()(interp(t));
                        if (newValue === 0 && (self._html.none !== '')) {
                            html = self._html.none;
                        } else if (newValue === 1 && (self._html.one !== '')) {
                            html = self._html.one;
                        } else if (self._html.some !== '') {
                            html = self._html.some;
                        }
                        node.innerHTML = html ? html.replace('%number', num) : num;
                    };
                });
        }
    }

    _doRedraw () {
        return this._doRender();
    }

    /**
     * Get or set a function to format the value for the display.
     * @method formatNumber
     * @memberof dc.numberDisplay
     * @instance
     * @see {@link https://github.com/d3/d3-format/blob/master/README.md#format d3.format}
     * @param {Function} [formatter=d3.format('.2s')]
     * @returns {Function|dc.numberDisplay}
     */
    formatNumber (formatter) {
        if (!arguments.length) {
            return this._formatNumber;
        }
        this._formatNumber = formatter;
        return this;
    }

}

export const numberDisplay = (parent, chartGroup) => new NumberDisplay(parent, chartGroup);
