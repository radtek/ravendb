﻿import app = require("durandal/app");
import router = require("plugins/router");
import virtualTable = require("widgets/virtualTable/viewModel");

import changeSubscription = require("common/changeSubscription");
import pagedList = require("common/pagedList");
import appUrl = require("common/appUrl");
import counterStorage = require("models/counter/counterStorage");
import counterChange = require("models/counter/counterChange");
import counterGroup = require("models/counter/counterGroup");
import getCounterGroupsCommand = require("commands/counter/getCounterGroupsCommand");
import updateCounterCommand = require("commands/counter/updateCounterCommand");
import resetCounterCommand = require("commands/counter/resetCounterCommand");
import viewModelBase = require("viewmodels/viewModelBase");
import editCounterDialog = require("viewmodels/counter/editCounterDialog");

class counters extends viewModelBase {

    groups = ko.observableArray<counterGroup>();
    allGroupsGroup: counterGroup;
    selectedGroup = ko.observable<counterGroup>().subscribeTo("ActivateGroup").distinctUntilChanged();
    currentGroup = ko.observable<counterGroup>();
    groupToSelectName: string;
    currentGroupPagedItems = ko.observable<pagedList>();
    selectedCounterIndices = ko.observableArray<number>();
    selectedCountersText: KnockoutComputed<string>;
    hasCounters: KnockoutComputed<boolean>;
    hasAnyCountersSelected: KnockoutComputed<boolean>;
    hasAllCountersSelected: KnockoutComputed<boolean>;
    isAnyCountersAutoSelected = ko.observable<boolean>(false);
    isAllCountersAutoSelected = ko.observable<boolean>(false);

    showLoadingIndicator = ko.observable<boolean>(false);
    showLoadingIndicatorThrottled = this.showLoadingIndicator.throttle(250);
    static gridSelector = "#countersGrid";

    constructor() {
        super();

        this.selectedGroup.subscribe(c => this.selectedGroupChanged(c));

        this.hasCounters = ko.computed(() => {
            var selectedGroup: counterGroup = this.selectedGroup();
            if (!!selectedGroup) {
                if (selectedGroup.name === counterGroup.allGroupsGroupName) {
                    var cs: counterStorage = this.activeCounterStorage();
                    return !!cs.statistics() ? cs.statistics().countersCount() > 0 : false;
                }
                return this.selectedGroup().countersCount() > 0;
            }
            return false;
        });

        this.hasAnyCountersSelected = ko.computed(() => this.selectedCounterIndices().length > 0);

        this.hasAllCountersSelected = ko.computed(() => {
            var numOfSelectedCounters = this.selectedCounterIndices().length;
            if (!!this.selectedGroup() && numOfSelectedCounters !== 0) {
                return numOfSelectedCounters === this.selectedGroup().countersCount();
            }
            return false;
        });

        this.selectedCountersText = ko.computed(() => {
            if (!!this.selectedCounterIndices()) {
                var documentsText = "counter";
                if (this.selectedCounterIndices().length !== 1) {
                    documentsText += "s";
                }
                return documentsText;
            }
            return "";
        });
    }

    activate(args) {
        super.activate(args);

        //TODO: update this in documentation
        //this.updateHelpLink('G8CDCP');

        // We can optionally pass in a group name to view's URL, e.g. #counterstorages/counters?group=Foo&counterstorage=test
        this.groupToSelectName = args ? args.group : null;

        var cs = this.activeCounterStorage();
        this.fetchGroups(cs).done(results => this.groupsLoaded(results, cs));
    }


    attached() {
        /*super.createKeyboardShortcut("F2", () => this.editSelectedCounter(), counters.gridSelector);*/

        // Q. Why do we have to setup the grid shortcuts here, when the grid already catches these shortcuts?
        // A. Because if the focus isn't on the grid, but on the docs page itself, we still need to catch the shortcuts.
        /*var docsPageSelector = ".documents-page";
        this.createKeyboardShortcut("DELETE", () => this.getDocumentsGrid().deleteSelectedItems(), docsPageSelector);
        this.createKeyboardShortcut("Ctrl+C, D", () => this.copySelectedDocs(), docsPageSelector);
        this.createKeyboardShortcut("Ctrl+C, I", () => this.copySelectedDocIds(), docsPageSelector);*/
    }

    createNotifications(): Array<changeSubscription> {
        return [
            //TODO: create subscription to all counters
            //shell.currentResourceChangesApi().watchAllCounters(() => this.fetchGroups())
        ];
    }

    createPostboxSubscriptions(): Array<KnockoutSubscription> {
        return [
            //ko.postbox.subscribe("EditItem", () => this.editSelectedDoc()),
            ko.postbox.subscribe("ChangesApiReconnected", (cs: counterStorage) => this.reloadCountersData(cs))
        ];
    }

    private fetchGroups(cs: counterStorage): JQueryPromise<any> {
        var deferred = $.Deferred();

        var getGroupsCommand = new getCounterGroupsCommand(cs);
        getGroupsCommand.execute().done((results: counterGroup[]) => deferred.resolve(results));
        return deferred;
    }

    groupsLoaded(groups: Array<counterGroup>, cs: counterStorage) {
        // Create the "All Groups" pseudo collection.
        this.allGroupsGroup = counterGroup.createAllGroupsCollection(cs);
        this.allGroupsGroup.countersCount = ko.computed(() => !!cs.statistics() ? cs.statistics().countersCount() : 0);

        // All systems a-go. Load them into the UI and select the first one.
        var allGroups = [this.allGroupsGroup].concat(groups);
        this.groups(allGroups);

        var groupToSelect = this.groups.first(g => g.name === this.groupToSelectName) || this.allGroupsGroup;
        groupToSelect.activate();
    }

    newCounter() {
        var counterChangeVm = new editCounterDialog();
        counterChangeVm.updateTask.done((change: counterChange) => {
            var counterCommand = new updateCounterCommand(this.activeCounterStorage(), change.group(), change.counterName(), change.delta(), change.isNew());
            counterCommand.execute();
        });
        app.showDialog(counterChangeVm);
    }

    edit() {
        var grid = this.getDocumentsGrid();
        if (grid) {
            grid.editLastSelectedItem();
        }
    }

    change() {
        var grid = this.getDocumentsGrid();
        if (grid) {
            var counterData = grid.getSelectedItems(1).first();
            var dto = {
                CurrentValue: counterData.Total,
                Group: counterData.Group,
                CounterName: counterData.Name,
                Delta: 0
            };
            var change = new counterChange(dto);
            var counterChangeVm = new editCounterDialog(change);
            counterChangeVm.updateTask.done((change: counterChange, isNew: boolean) => {
                var counterCommand = new updateCounterCommand(this.activeCounterStorage(), change.group(), change.counterName(), change.delta(), isNew);
                counterCommand.execute();
                //TODO: refresh grid
            });
            app.showDialog(counterChangeVm);
        }
    }

    reset() {
        var grid = this.getDocumentsGrid();
        if (grid) {
            var counterData = grid.getSelectedItems(1).first();
            var confirmation = this.confirmationMessage("Reset Counter", "Are you sure that you want to reset the counter?");
            confirmation.done(() => {
                var resetCounter = new resetCounterCommand(this.activeCounterStorage(), counterData.Group, counterData.Name);
                resetCounter.execute();
                //TODO: refresh grid
            });
        }
    }

    deleteCounter() {
        var grid = this.getDocumentsGrid();
        if (grid) {
            var counterData = grid.getSelectedItems(1).first();
            var confirmation = this.confirmationMessage("Reset Counter", "Are you sure that you want to reset the counter?");
            confirmation.done(() => {
                var resetCounter = new resetCounterCommand(this.activeCounterStorage(), counterData.Group, counterData.Name);
                resetCounter.execute();
                //TODO: refresh grid
            });
        }
    }

    private selectedGroupChanged(selected: counterGroup) {
        if (!!selected) {
            var pagedList = selected.getCounters();
            this.currentGroupPagedItems(pagedList);
            this.currentGroup(selected);
        }
    }

    toggleSelectAll() {
        var docsGrid = this.getDocumentsGrid();

        if (!!docsGrid) {
            if (this.hasAnyCountersSelected()) {
                docsGrid.selectNone();
            } else {
                docsGrid.selectSome();
                this.isAnyCountersAutoSelected(this.hasAllCountersSelected() === false);
            }
        }
    }

    selectAll() {
        var docsGrid = this.getDocumentsGrid();
        var group: counterGroup = this.selectedGroup();
        if (!!docsGrid && !!group) {
            docsGrid.selectAll(group.countersCount());
        }
    }

    selectNone() {
        var docsGrid = this.getDocumentsGrid();
        if (!!docsGrid) {
            docsGrid.selectNone();
        }
    }

    deleteSelectedCounters() {
        if (!this.selectedGroup().isAllGroupsGroup && this.hasAllCountersSelected()) {
            this.deleteGroup(this.selectedGroup());
        } else {
            var grid = this.getDocumentsGrid();
            if (grid) {
                grid.deleteSelectedItems();
            }
        }
    }

    deleteGroup(group: counterGroup) {
        /*if (collection) {
            var viewModel = new deleteCollection(collection);
            viewModel.deletionTask.done((result: operationIdDto) => {
                if (!collection.isAllDocuments) {
                    this.collections.remove(collection);

                    var selectedCollection: collection = this.selectedCollection();
                    if (collection.name == selectedCollection.name) {
                        this.selectCollection(this.allDocumentsCollection);
                    }
                } else {
                    this.selectNone();
                }

                this.updateGridAfterOperationComplete(collection, result.OperationId);
            });
            app.showDialog(viewModel);
        }*/
    }

    private updateGroups(receivedGroups: Array<counterGroup>) {
        var deletedGroups = [];

        this.groups().forEach((group: counterGroup) => {
            if (!receivedGroups.first((receivedGroup: counterGroup) => group.name === receivedGroup.name) && group.name !== "All Groups") {
                deletedGroups.push(group);
            }
        });

        this.groups.removeAll(deletedGroups);

        receivedGroups.forEach((receivedGroup: counterGroup) => {
            var foundGroup = this.groups().first((group: counterGroup) => group.name === receivedGroup.name);
            if (!foundGroup) {
                this.groups.push(receivedGroup);
            } else {
                foundGroup.countersCount(receivedGroup.countersCount());
            }
        });

        //if the group is deleted, go to the all groups group
        var currentGroup: counterGroup = this.groups().first(g => g.name === this.selectedGroup().name);
        if (!currentGroup || currentGroup.countersCount() === 0) {
            this.selectedGroup(this.allGroupsGroup);
        }
    }

    private refreshGroupsData() {
        var selectedGroup: counterGroup = this.selectedGroup();

        this.groups().forEach((group: counterGroup) => {
            if (group.name === selectedGroup.name) {
                var docsGrid = this.getDocumentsGrid();
                if (!!docsGrid) {
                    docsGrid.refreshCollectionData();
                }
            } else {
                var pagedList = group.getCounters();
                pagedList.invalidateCache();
            }
        });
    }


    private refreshGroups(): JQueryPromise<any> {
        var deferred = $.Deferred();
        var cs = this.activeCounterStorage();

        this.fetchGroups(cs).done(results => {
            this.updateGroups(results);
            //TODO: add a button to refresh the counters and than use this.refreshCollectionsData();
            deferred.resolve();
        });

        return deferred;
    }

    private reloadCountersData(cs: counterStorage) {
        if (cs.name === this.activeCounterStorage().name) {
            this.refreshGroups().done(() => {
                this.refreshGroupsData();
            });
        }
    }

    selectGroup(group: counterGroup, event?: MouseEvent) {
        if (!event || event.which !== 3) {
            group.activate();
            var countersWithGroupUrl = appUrl.forCounterStorageCounters(group.name, this.activeCounterStorage());
            router.navigate(countersWithGroupUrl, false);
        }
    }

    private getDocumentsGrid(): virtualTable {
        var gridContents = $(counters.gridSelector).children()[0];
        if (gridContents) {
            return ko.dataFor(gridContents);
        }

        return null;
    }
}

export = counters;