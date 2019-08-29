import * as d3 from 'd3';

import {events} from '../core/events';
import {BaseMixin} from '../base/base-mixin';

/**
 * The cboxMenu is a simple widget designed to filter a dimension by
 * selecting option(s) from a set of HTML `<input />` elements. The menu can be
 * made into a set of radio buttons (single select) or checkboxes (multiple).
 * @class cboxMenu
 * @memberof dc
 * @mixes dc.baseMixin
 * @example
 * // create a cboxMenu under #cbox-container using the default global chart group
 * var cbox = dc.cboxMenu('#cbox-container')
 *                .dimension(states)
 *                .group(stateGroup);
 * // the option text can be set via the title() function
 * // by default the option text is '`key`: `value`'
 * cbox.title(function (d){
 *     return 'STATE: ' + d.key;
 * })
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.
 * @param {String} [chartGroup] - The name of the chart group this widget should be placed in.
 * Interaction with the widget will only trigger events and redraws within its group.
 * @returns {cboxMenu}
 **/
const GROUP_CSS_CLASS = 'dc-cbox-group';
const ITEM_CSS_CLASS = 'dc-cbox-item';

function _onChange (d, i, self) {
    let values;
    const target = d3.select(d3.event.target);
    let options;

    if (!target.datum()) {
        values = self._promptValue || null;
    } else {
        options = d3.select(this).selectAll('input')
            .filter(function (o) {
                if (o) {
                    return this.checked;
                }
            });
        values = options.nodes().map(function (option) {
            return option.value;
        });
        // check if only prompt option is selected
        if (!self._multiple && values.length === 1) {
            values = values[0];
        }
    }
    self.onChange(values);
}

export class CboxMenu extends BaseMixin {
    constructor (parent, chartGroup) {
        super();

        this._cbox = undefined;
        this._promptText = 'Select all';
        this._multiple = false;
        this._inputType = 'radio';
        this._promptValue = null;

        // ES6, can we use utils.uniqueId
        // generate a random number to use as an ID
        this._randVal = Math.floor(Math.random() * (100000)) + 1;

        this.data((group) => {
            return group.all().filter(this._filterDisplayed);
        });

        // There is an accessor for this attribute, initialized with default value
        this._filterDisplayed = (d) => {
            return this.valueAccessor()(d) > 0;
        };

        this._order = (a, b) => {
            return this.keyAccessor()(a) > this.keyAccessor()(b) ? 1 :
                this.keyAccessor()(b) > this.keyAccessor()(a) ? -1 :
                    0;
        };

        this.anchor(parent, chartGroup);
    }

    _doRender () {
        return this._doRedraw();
    }

    _doRedraw () {
        const self = this;

        self.select('ul').remove();
        self._cbox = self.root()
            .append('ul')
            .classed(GROUP_CSS_CLASS, true);
        self._renderOptions();

        if (self.hasFilter() && self._multiple) {
            self._cbox.selectAll('input')
                .property('checked', function (d) {
                    // adding `false` avoids failing test cases in phantomjs
                    return d && self.filters().indexOf(String(self.keyAccessor()(d))) >= 0 || false;
                });
        } else if (self.hasFilter()) {
            self._cbox.selectAll('input')
                .property('checked', function (d) {
                    if (!d) {
                        return false;
                    }
                    return self.keyAccessor()(d) === self.filter();
                });
        }
        return self;
    }

    _renderOptions () {
        let options = this._cbox
            .selectAll('li.' + ITEM_CSS_CLASS)
            .data(this.data(), d => this.keyAccessor()(d));

        options.exit().remove();

        options = options.enter()
            .append('li')
            .classed(ITEM_CSS_CLASS, true)
            .merge(options);

        options
            .append('input')
            .attr('type', this._inputType)
            .attr('value', d => this.keyAccessor()(d))
            .attr('name', 'domain_' + this._randVal)
            .attr('id', (d, i) => 'input_' + this._randVal + '_' + i);
        options
            .append('label')
            .attr('for', (d, i) => 'input_' + this._randVal + '_' + i)
            .text(this.title());

        const self = this;
        // 'all' option
        if (this._multiple) {
            this._cbox
                .append('li')
                .append('input')
                .attr('type', 'reset')
                .text(this._promptText)
                .on('click', function (d, i) {
                    return _onChange.call(this, d, i, self);
                });
        } else {
            const li = this._cbox.append('li');
            li.append('input')
                .attr('type', this._inputType)
                .attr('value', this._promptValue)
                .attr('name', 'domain_' + this._randVal)
                .attr('id', (d, i) => 'input_' + this._randVal + '_all')
                .property('checked', true);
            li.append('label')
                .attr('for', (d, i) => 'input_' + this._randVal + '_all')
                .text(this._promptText);
        }

        this._cbox
            .selectAll('li.' + ITEM_CSS_CLASS)
            .sort(this._order);

        this._cbox.on('change',  function (d, i) {
            return _onChange.call(this, d, i, self);
        });
        return options;
    }

    onChange (val) {
        const self = this;
        if (val && self._multiple) {
            self.replaceFilter([val]);
        } else if (val) {
            self.replaceFilter(val);
        } else {
            self.filterAll();
        }
        events.trigger(function () {
            self.redrawGroup();
        });
    }

    /**
     * Get or set the function that controls the ordering of option tags in the
     * cbox menu. By default options are ordered by the group key in ascending
     * order.
     * @method order
     * @memberof dc.cboxMenu
     * @instance
     * @param {Function} [order]
     * @returns {Function|dc.cboxMenu}
     * @example
     * // order by the group's value
     * chart.order(function (a,b) {
     *     return a.value > b.value ? 1 : b.value > a.value ? -1 : 0;
     * });
     **/
    order (order) {
        if (!arguments.length) {
            return this._order;
        }
        this._order = order;
        return this;
    }

    /**
     * Get or set the text displayed in the options used to prompt selection.
     * @method promptText
     * @memberof dc.cboxMenu
     * @instance
     * @param {String} [promptText='Select all']
     * @returns {String|dc.cboxMenu}
     * @example
     * chart.promptText('All states');
     **/
    promptText (promptText) {
        if (!arguments.length) {
            return this._promptText;
        }
        this._promptText = promptText;
        return this;
    }

    /**
     * Get or set the function that filters options prior to display. By default options
     * with a value of < 1 are not displayed.
     * @method filterDisplayed
     * @memberof dc.cboxMenu
     * @instance
     * @param {function} [filterDisplayed]
     * @returns {Function|dc.cboxMenu}
     * @example
     * // display all options override the `filterDisplayed` function:
     * chart.filterDisplayed(function () {
     *     return true;
     * });
     **/
    filterDisplayed (filterDisplayed) {
        if (!arguments.length) {
            return this._filterDisplayed;
        }
        this._filterDisplayed = filterDisplayed;
        return this;
    }

    /**
     * Controls the type of input element. Setting it to true converts
     * the HTML `input` tags from radio buttons to checkboxes.
     * @method multiple
     * @memberof dc.cboxMenu
     * @instance
     * @param {boolean} [multiple=false]
     * @returns {Boolean|dc.cboxMenu}
     * @example
     * chart.multiple(true);
     **/
    multiple (multiple) {
        if (!arguments.length) {
            return this._multiple;
        }
        this._multiple = multiple;
        if (this._multiple) {
            this._inputType = 'checkbox';
        } else {
            this._inputType = 'radio';
        }
        return this;
    }

    /**
     * Controls the default value to be used for
     * [dimension.filter](https://github.com/crossfilter/crossfilter/wiki/API-Reference#dimension_filter)
     * when only the prompt value is selected. If `null` (the default), no filtering will occur when
     * just the prompt is selected.
     * @method promptValue
     * @memberof dc.cboxMenu
     * @instance
     * @param {?*} [promptValue=null]
     * @returns {*|dc.cboxMenu}
     **/
    promptValue (promptValue) {
        if (!arguments.length) {
            return this._promptValue;
        }
        this._promptValue = promptValue;

        return this;
    }

}

export const cboxMenu = (parent, chartGroup) => new CboxMenu(parent, chartGroup);
