"use strict";

import GLib from 'gi://GLib';

/**
 * Represents a set of background tasks, executed asynchronously.
 */
export class Tasks {
    constructor() {
        this._tasks = new Set();
    }

    /**
     * Start executing a new background task.
     * 
     * This task is a dependency of another task.
     *
     * @param function fn Function to execute as a task.
     */
    newSubtask(fn) {
        this._new(fn, GLib.PRIORITY_DEFAULT_IDLE);
    }

    /**
     * Start executing a new background task.
     *
     * This task can depend on other tasks, but nothing can depend on this one.
     *
     * @param function fn Function to execute as a task.
     */
    newTask(fn) {
        this._new(fn, GLib.PRIORITY_LOW);
    }

    _new(fn, priority) {
        let that = this;
        let decoratedFn = () => {
            fn();
            that._tasks.delete(task);
        };
        let task = new Task(decoratedFn, priority);

        this._tasks.add(task);
    }

    /**
     * Cancel all pending tasks.
     */
    cancel() {
        this._tasks.forEach((task) => {
            task.cancel();
        });
        this._tasks.clear();
    }
}

/**
 * Represents a background tasks, executed asynchronously.
 * 
 * Registers a new  background task ready to be executed asynchronously.
 */
let Task = class {

    constructor(fn, priority) {
        this._sourceId = null
        this._run(fn, priority)
    }

    _attachSource = function(sourceId) {
        this._sourceId = sourceId;
    }

    _detachSource = function() {
        if (this._sourceId) {
            GLib.Source.remove(this._sourceId);
            this._sourceId = null;
        }
    }

    _run(fn, priority) {
        let that = this;

        this._attachSource(GLib.idle_add(priority, function() {
            fn();
            that._detachSource();

            return GLib.SOURCE_REMOVE;
        }));
    }

    /**
     * Remove task from the background queue, if execution has not been started yet.
     */
    cancel() {
        this._detachSource();
    }
};