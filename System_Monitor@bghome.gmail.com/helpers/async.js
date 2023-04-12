"use strict";

const GLib = imports.gi.GLib;

/**
 * Represents a set of background tasks, executed asynchronously.
 */
var Tasks = class {
    #tasks
    constructor() {
        this.#tasks = new Set();
    }

    /**
     * Start executing a new background task.
     * 
     * This task is a dependency of another task.
     *
     * @param function fn Function to execute as a task.
     */
    newSubtask(fn) {
        this.#new(fn, GLib.PRIORITY_DEFAULT_IDLE);
    }

    /**
     * Start executing a new background task.
     *
     * This task can depend on other tasks, but nothing can depend on this one.
     *
     * @param function fn Function to execute as a task.
     */
    newTask(fn) {
        this.#new(fn, GLib.PRIORITY_LOW);
    }

    #new(fn, priority) {
        let that = this;
        let decoratedFn = () => {
            fn();
            that.#tasks.delete(task);
        };
        let task = new Task(decoratedFn, priority);

        this.#tasks.add(task);
    }

    /**
     * Cancel all pending tasks.
     */
    cancel() {
        this.#tasks.forEach((task) => {
            task.cancel();
        });
        this.#tasks.clear();
    }
};

/**
 * Represents a background tasks, executed asynchronously.
 * 
 * Registers a new  background task ready to be executed asynchronously.
 */
let Task = class {
    #sourceId
    constructor(fn, priority) {
        this.#run(fn, priority)
    }

    #attachSource = function(sourceId) {
        this.#sourceId = sourceId;
    }

    #detachSource = function() {
        if (this.#sourceId) {
            GLib.Source.remove(this.#sourceId);
            this.#sourceId = null;
        }
    }

    #run(fn, priority) {
        let that = this;

        this.#attachSource(GLib.idle_add(priority, function() {
            fn();
            that.#detachSource();

            return GLib.SOURCE_REMOVE;
        }));
    }

    /**
     * Remove task from the background queue, if execution has not been started yet.
     */
    cancel() {
        this.#detachSource();
    }
};