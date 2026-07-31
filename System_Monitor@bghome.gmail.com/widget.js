"use strict";

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Pango from 'gi://Pango';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Util from './util.js';

const BaseMenuItem = GObject.registerClass(
class BaseMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(text, options) {
        options = options || {};
        let icon = options.icon, summary_text = options.summary_text, button_icon = options.button_icon, button_callback = options.button_callback,
        button_trigger_key = options.button_trigger_key;
        delete options.icon;
        delete options.summary_text;
        delete options.button_icon;
        delete options.button_callback;
        delete options.button_trigger_key;
        super._init(options);
        let that = this;

        if (icon) {
            this.setIcon(icon);
        }

        this.label = new St.Label({text: text, style_class: "item-label"});
        this.label.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.label.clutter_text.set_single_line_mode(false);
        this.actor.add_child(this.label);
        this._change_event_id = this.connect('notify::active', menuItem => {
            // Expand ellipsized label.
            for (let label of this.getAllLabels()) {
                label.clutter_text.set_line_wrap(menuItem.active);
                label.clutter_text.set_ellipsize(menuItem.active ? Pango.EllipsizeMode.NONE : Pango.EllipsizeMode.END);
            }
        });

        if (summary_text) {
            this.rightLabel = new St.Label({text: summary_text, style_class: "right-label", x_expand: true, x_align: Clutter.ActorAlign.END});
            this.actor.add_child(this.rightLabel);
        }

        if (button_icon) {
            this.button = new St.Button({x_expand: true, x_align: Clutter.ActorAlign.END});
            this.button._click_event_id = this.button.connect('clicked', function(actor, event) {
                button_callback.call(that.button, actor, event, that.getState());
            });
            this.button_icon = new St.Icon({
                icon_name: button_icon,
                icon_size: 14,
                style_class: 'system-status-icon'
            });
            this.button.set_child(this.button_icon);
            this.actor.add_child(this.button);
        }
    }

    destroy() {
        if (this._change_event_id) {
            this.disconnect(this._change_event_id);
            this._change_event_id = null;
        }
        if (this.button instanceof St.Button && this.button._click_event_id) {
            this.button.disconnect(this.button._click_event_id);
            this.button._click_event_id = null;
        }
    }

    setLabel(text) {
        this.label.text = text;
    }

    setIcon(icon) {
        this.icon = icon;
        this.actor.add_child(this.icon);
    }

    switchToIcon(icon) {
        let children = this.actor.get_children();
        let position = -1;
        for (let i in children) {
            if (children[i] == this.icon) {
                position = i;
                break;
            }
        }

        if (position != -1) {
            this.actor.remove_child(this.icon);
            this.icon = icon;
            this.actor.insert_child_at_index(this.icon, position);
        }
    }

    hideIcon() {
        this.icon.hide();
    }

    showIcon() {
        this.icon.show();
    }

    setSummaryText(text) {
        this.rightLabel.text = text;
    }

    hideButton() {
        this.button.hide();
    }

    showButton() {
        this.button.show();
    }

    setState(state) {
        this._state = state;
    }

    getState() {
        return this._state || {};
    }

    getAllLabels() {
        return [this.label];
    }
});

export const ResourceTitleItem = GObject.registerClass(
class ResourceTitleItem extends St.Widget {
    #rightLabel;

    constructor(text, icon, summary_text) {
        super({
            name: 'resource-title',
            layout_manager: new Clutter.BoxLayout({homogeneous: false, orientation: Clutter.Orientation.HORIZONTAL}),
            style_class: 'resource-title'
        });

        this.add_child(icon);

        let leftLabel = new St.Label({text: text, style_class: 'resource-title-label', x_expand: true, y_expand: true, x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.CENTER});
        this.add_child(leftLabel);

        this.#rightLabel = new St.Label({text: summary_text, style_class: 'resource-title-label', x_expand: true, y_expand: true, x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this.#rightLabel);
    }

    setSummaryText(text) {
        this.#rightLabel.set_text(text);
    }
});

export const ProcessItem = GObject.registerClass(
class ProcessItem extends BaseMenuItem {
    _init(text, button_icon, button_callback, button_trigger_key) {
        super._init(text, {"button_icon": button_icon, "button_callback": button_callback, "button_trigger_key": button_trigger_key, "activate": false});
    }
});

export const MountItem = GObject.registerClass(
class MountItem extends BaseMenuItem {
    _init(text) {
        super._init(text, {"activate": false});
    }
});

export const StateItem = GObject.registerClass(
class StateItem extends BaseMenuItem {
    _init(text) {
        super._init(text, {"activate": false});
    }
});

export const InterfaceItem = GObject.registerClass(
class InterfaceItem extends BaseMenuItem {
    _init(text) {
        let icon = new St.Icon({
            icon_name: 'network-wired-no-route-symbolic',
            icon_size: 14,
            style_class: 'system-status-icon',
            y_align: Clutter.ActorAlign.START
        });
        super._init(text, {"icon": icon});

        this.download_icon = new St.Icon({
            icon_name: 'network-receive-symbolic',
            icon_size: 14,
            style_class: 'interface-icon',
            x_expand: true,
            x_align:Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START
        });
        this.upload_icon = new St.Icon({
            icon_name: 'network-transmit-symbolic',
            icon_size: 14,
            style_class: 'interface-icon',
            x_expand: true,
            x_align:Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START
        });
        this.download_text = new St.Label({
            text: 'loading...',
            style_class: 'bytes-text',
            x_expand: true,
            x_align:Clutter.ActorAlign.END
        });
        this.upload_text = new St.Label({
            text: 'loading...',
            style_class: 'bytes-text',
            x_expand: true,
            x_align:Clutter.ActorAlign.END
        });

        let container = new St.BoxLayout({vertical: false, x_expand: true, x_align:Clutter.ActorAlign.END});
        this.actor.add_child(container);

        container.add_child(this.download_text);
        container.add_child(this.download_icon);
        container.add_child(this.upload_text);
        container.add_child(this.upload_icon);
    }
    switchToLoopBackIcon() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'computer-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon',
                y_align: Clutter.ActorAlign.START
            })
        );
    }
    switchToWiredIcon() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wired-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon',
                y_align: Clutter.ActorAlign.START
            })
        );
    }
    switchToWirelessIcon() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wireless-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon',
                y_align: Clutter.ActorAlign.START
            })
        );
    }
    switchToUnknownIcon() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wired-no-route-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon',
                y_align: Clutter.ActorAlign.START
            })
        );
    }
    setDownloadText(text) {
        this.download_text.text = text;
    }
    setUploadText(text) {
        this.upload_text.text = text;
    }
    hideIcon() {
        this.icon.hide();
        this.download_icon.hide();
        this.upload_icon.hide();
    }

    showIcon() {
        this.icon.show();
        this.download_icon.show();
        this.upload_icon.show();
    }

    getAllLabels() {
        let labels = [
            this.download_text,
            this.upload_text
        ];

        return [...super.getAllLabels(), ...labels];
    }
});

export const MeterAreaContainer = GObject.registerClass(
class MeterAreaContainer extends PopupMenu.PopupBaseMenuItem {
    constructor() {
        super({
            style_class: "meter-area-container"
        });
        this._meter_box = new St.BoxLayout();
        this._scroll_view = new St.ScrollView({
            style_class: "meter-area-scrollview"
        });
        // GNOME 45 uses add_actor(); GNOME 46+ replaced it with set_child().
        if (this._scroll_view.set_child) {
            this._scroll_view.set_child(this._meter_box);
        } else {
            this._scroll_view.add_actor(this._meter_box);
        }
        // vscrollbar is always off; hscrollbar policy is driven explicitly by
        // setMaxWidth() below rather than left on AUTOMATIC (see there for why).
        if (this._scroll_view.set_policy) {
            this._scroll_view.set_policy(St.PolicyType.NEVER, St.PolicyType.NEVER);
        } else {
            this._scroll_view.hscrollbar_policy = St.PolicyType.NEVER;
            this._scroll_view.vscrollbar_policy = St.PolicyType.NEVER;
        }
        this.actor.add_child(this._scroll_view);
    }
    setOrientation(orientation) {
        this._meter_box.orientation = orientation;
    }
    getWidth() {
        return this._scroll_view.width;
    }
    setMaxWidth(px) {
        // Always set an explicit width rather than relying on St.ScrollView's own
        // unconstrained preferred size, which is not guaranteed to equal the
        // content's natural width (scroll views commonly default to a small
        // baseline size instead of sizing to their child, requiring an explicit
        // opt-in to do otherwise). Size to the content's own natural width when
        // it fits - so the viewport matches the content exactly and no scrollbar
        // appears - or to the clamped budget when it doesn't - so the viewport is
        // smaller than the content and the columns stay full width and scrollable
        // instead of being shrunk to fit.
        //
        // This must be a hard actor width, not a CSS max-width or St's
        // natural-width-set: St.ScrollView implements its own get_preferred_width
        // (to account for the child plus scrollbar), so it does not consult
        // St.Widget's generic natural-width override, and a CSS max-width here
        // would also cap the columns' own natural width instead of letting them
        // overflow into the scrollable area. A hard Clutter width is enforced by
        // ClutterActor before any subclass vfunc runs, so it always applies.
        let [, natural_width] = this._meter_box.get_preferred_width(-1);
        let needs_scroll = px && natural_width > px;
        this._scroll_view.width = needs_scroll ? px : natural_width;

        // Drive the hscrollbar policy from our own overflow check instead of
        // leaving it on AUTOMATIC: St.ScrollView's own "hide if nothing to
        // scroll" logic doesn't reliably re-run after we force this width -
        // measured directly, the scrollbar actor stayed visible even once the
        // adjustment's page-size caught up to equal its upper bound (i.e. even
        // with nothing left to scroll). We already know from natural_width vs.
        // px whether scrolling is actually needed, so use that instead of
        // relying on St to notice on its own.
        if (this._scroll_view.set_policy) {
            this._scroll_view.set_policy(needs_scroll ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER, St.PolicyType.NEVER);
        } else {
            this._scroll_view.hscrollbar_policy = needs_scroll ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER;
        }
    }
    addMeter(meter, position) {
        if (!meter instanceof MeterContainer) {
            throw new TypeError("First argument of addMeter() method must be instance of MeterContainer.");
        }
        if (position == undefined) {
            this._meter_box.add_child(meter);
        } else {
            this._meter_box.insert_child_at_index(meter, position);
        }
    }
    removeMeter(meter) {
        if (!meter instanceof MeterContainer) {
            throw new TypeError("First argument of removeMeter() method must be instance of MeterContainer.");
        }
        this._meter_box.remove_child(meter);
    }
});

const MeterContainer = GObject.registerClass(
class MeterContainer extends St.BoxLayout {
    _init() {
        super._init({"vertical": true});
        this._menu_items = [];
    }
    addTitleItem(item) {
        if (!item instanceof ResourceTitleItem) {
            throw new TypeError("First argument of addTitleItem() method must be instance of ResourceTitleItem.");
        }
        this.add_child(item);
        this._label_item = item;
    }
    addMenuItem(item) {
        if (!item instanceof BaseMenuItem) {
            throw new TypeError("First argument of addMenuItem() method must be instance of BaseMenuItem.");
        }
        this.add_child(item);
        this._menu_items.push(item);
    }
    removeAllMenuItems() {
        for (let item of this._menu_items) {
            this.remove_child(item);
            item.destroy();
        }
        this._menu_items.length = 0;
    }
    freeze() {
        // Use a hard actor width, not St's natural-width/natural-width-set:
        // that pair only overrides the *natural* component, while the
        // *minimum* is still computed dynamically per for_height (labels here
        // wrap, so less height means a larger required width). If the popup
        // is later reflowed at a smaller height - e.g. boxpointer shrinking it
        // to fit the screen - the frozen natural-width can end up below the
        // newly computed minimum, which Clutter treats as a fatal error and
        // crashes the whole shell. A hard width pins both min and natural to
        // the same value for every for_height, so that can't happen.
        let [min_width, natural_width] = this.get_preferred_width(-1);
        this.width = Math.max(natural_width, min_width);
    }
    unfreeze() {
        this.width = -1;
    }
    update(state) {
        this._label_item.setSummaryText(Math.round(state.percent) + ' %');
    }
});

export const ProcessItemsContainer = GObject.registerClass(
class ProcessItemsContainer extends MeterContainer {
    update(state) {
        super.update(state);

        for (let i = 0; i < this._menu_items.length; i++) {
            if (i in state.processes) {
                let process = state.processes[i];
                this._menu_items[i].setLabel(process.command);
                this._menu_items[i].showButton();
                this._menu_items[i].setState(process);
            } else {
                this._menu_items[i].setLabel(' ');
                this._menu_items[i].hideButton();
                this._menu_items[i].setState({});
            }
        }
    }
});

export const SystemLoadItemsContainer = GObject.registerClass(
class SystemLoadItemsContainer extends MeterContainer {
    update(state) {
        super.update(state);

        let load = state.system_load;
        this._menu_items[0].setLabel(load.load_average_1 + ' / ' + load.load_average_5 + ' / ' + load.load_average_15);
        this._menu_items[1].setLabel(
            '%running% out of %all% tasks are running'
                .replace('%running%', load.running_tasks_count)
                .replace('%all%', load.tasks_count)
        );
        for (let i = 2; i < this._menu_items.length; i++) {
            this._menu_items[i].setLabel(' ');
        }
    }
});

export const DirectoriesContainer = GObject.registerClass(
class DirectoriesContainer extends MeterContainer {
    _init() {
        super._init();
        this._directories = new Util.Directories();
    }

    update(state) {
        super.update(state);

        for (let i = 0; i < this._menu_items.length; i++) {
            if (i in state.directories) {
                let directory = state.directories[i];
                this._menu_items[i].setLabel(
                    '%mount_dir% (%size% free)'
                        .replace('%mount_dir%', directory.name)
                        .replace('%size%', this._directories.formatBytes(directory.free_size))
                );
            } else {
                this._menu_items[i].setLabel(' ');
            }
        }
    }
});

export const NetworkInterfaceItemsContainer = GObject.registerClass(
class NetworkInterfaceItemsContainer extends MeterContainer {
    _init() {
        super._init();
        this._network = new Util.Network();
    }

    update(state) {
        super.update(state);

        for (let i = 0; i < this._menu_items.length; i++) {
            if (i in state.interfaces) {
                let network_interface = state.interfaces[i];
                this._menu_items[i].setLabel(network_interface.name + ': ');
                this._menu_items[i].setDownloadText(this._network.formatBytes(network_interface.download));
                this._menu_items[i].setUploadText(this._network.formatBytes(network_interface.upload));
                switch(network_interface.type) {
                    case 'loopback':
                        this._menu_items[i].switchToLoopBackIcon();
                        break;
                    case 'wired':
                        this._menu_items[i].switchToWiredIcon();
                        break;
                    case 'wireless':
                        this._menu_items[i].switchToWirelessIcon();
                        break;
                    default:
                        this._menu_items[i].switchToUnknownIcon();
                }
                this._menu_items[i].showIcon();
            } else {
                this._menu_items[i].setLabel(' ');
                this._menu_items[i].setDownloadText(' ');
                this._menu_items[i].setUploadText(' ');
                this._menu_items[i].hideIcon();
            }
        }
    }
});
