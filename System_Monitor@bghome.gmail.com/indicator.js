const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

// Array of colors.
let color_range = [];

// CSS class name.
let caution_class = '';

const Icon = new Lang.Class({
    Name: 'Icon',
    Extends: St.Icon
});

// Take an array of color defined by RGB components and set it static.
Icon.initColorRange = function(colors) {
	if (color_range.length == 0) {
		for (let i in colors) {
			color_range.push(new Clutter.Color(colors[i]));
		}
	}
}

// Set static CSS class name.
Icon.initCautionClass = function(name) {
	caution_class = name;
}

// Change the color of the icon by interpolating the color range.
Icon.prototype.setProgress = function(percent) {
  if (isNaN(percent)) {
      throw new TypeError('Percent parameter must be a number, but "' + percent + '" given.');
  }

	if (percent <= 0 || color_range.length < 2) {
		this.style = null;
		return this;
	}

	var split_value = (color_range.length - 1) * percent / 100;
	var progress = split_value == color_range.length -1 ? 1 : split_value % 1;
	if (split_value == Math.round(split_value)) {
		split_value += split_value + 0.1 < color_range.length - 1 ? 0.1 : -0.1;
	}
	var initial_color = color_range[Math.floor(split_value)];
	var final_color = color_range[Math.ceil(split_value)];
	var color = initial_color.interpolate(final_color, progress);

	this.style = 'color: rgb(' +
		color.red + ',' +
		color.green + ',' +
		color.blue +
		');';

	return this;
};

// Change icon style to indicate warning/event
Icon.prototype.cautionOn = function() {
	this.add_style_class_name(caution_class);
	return this;
}

// Change icon state to normal
Icon.prototype.cautionOff = function() {
	this.remove_style_class_name(caution_class);
	return this;
}

Icon.prototype.update = function(state) {
	this.setProgress(state.percent);
	if (state.has_activity) {
		this.cautionOn();
	} else {
		this.cautionOff();
	}
}
