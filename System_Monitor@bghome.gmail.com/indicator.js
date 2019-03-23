const { Clutter, GObject, St } = imports.gi;

var Icon = GObject.registerClass(
class Icon extends St.Icon {
    _init(options, colors, caution_class, can_show_activity) {
        super._init(options);
        this.initColorRange(colors);
        this.initCautionClass(caution_class);
        this.initCanShowActivity(can_show_activity);
    }
});

// Take an array of color defined by RGB components and set it static.
Icon.prototype.initColorRange = function(colors) {
    if (!this.color_range) {
        this.color_range = [];
    }
    if (this.color_range.length == 0) {
		for (let i in colors) {
			this.color_range.push(new Clutter.Color(colors[i]));
		}
	}
}

// Set static CSS class name.
Icon.prototype.initCautionClass = function(name) {
	this.caution_class = name;
}

// On/Off switch to get the user's attention about indicator activity.
Icon.prototype.initCanShowActivity = function(show_activity) {
	this.can_show_activity = show_activity;
}

// Change the color of the icon by interpolating the color range.
Icon.prototype.setProgress = function(percent) {
    if (isNaN(percent)) {
        throw new TypeError('Percent parameter must be a number, but "' + percent + '" given.');
    }

	if (percent <= 0 || this.color_range.length < 2) {
		this.style = null;
		return this;
	}

	var split_value = (this.color_range.length - 1) * percent / 100;
	var progress = split_value == this.color_range.length -1 ? 1 : split_value % 1;
	if (split_value == Math.round(split_value)) {
		split_value += split_value + 0.1 < this.color_range.length - 1 ? 0.1 : -0.1;
	}
	var initial_color = this.color_range[Math.floor(split_value)];
	var final_color = this.color_range[Math.ceil(split_value)];
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
	this.add_style_class_name(this.caution_class);
	return this;
}

// Change icon state to normal
Icon.prototype.cautionOff = function() {
	this.remove_style_class_name(this.caution_class);
	return this;
}

Icon.prototype.update = function(state) {
	this.setProgress(state.percent);
	if (this.can_show_activity && state.has_activity) {
		this.cautionOn();
	} else {
		this.cautionOff();
	}
}
