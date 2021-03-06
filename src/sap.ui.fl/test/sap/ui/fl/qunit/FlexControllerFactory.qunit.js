/*global QUnit*/

sap.ui.define([
	"sap/ui/core/Component",
	"sap/ui/fl/apply/_internal/flexState/FlexState",
	"sap/ui/fl/apply/_internal/changes/Applier",
	"sap/ui/fl/FlexControllerFactory",
	"sap/ui/fl/ChangePersistence",
	"sap/ui/fl/Utils",
	"sap/ui/fl/variants/VariantModel",
	"sap/ui/thirdparty/jquery",
	"sap/ui/thirdparty/sinon-4"
],
function (
	Component,
	FlexState,
	Applier,
	FlexControllerFactory,
	ChangePersistence,
	Utils,
	VariantModel,
	jQuery,
	sinon
) {
	"use strict";

	var sandbox = sinon.sandbox.create();

	QUnit.module("sap.ui.fl.FlexControllerFactory", {
		beforeEach: function () {
			this.oInitializeStub = sandbox.stub(FlexState, "initialize").resolves();
		},
		afterEach: function () {
			sandbox.restore();
		}
	}, function() {
		QUnit.test("shall provide an API to create a FlexController", function (assert) {
			assert.strictEqual(typeof FlexControllerFactory.create, 'function');
		});

		QUnit.test("shall create a new FlexController", function (assert) {
			assert.ok(FlexControllerFactory.create("myComponent"));
		});

		QUnit.test("shall cache and reuse the created FlexController instances", function (assert) {
			var oFlexController1 = FlexControllerFactory.create("myComponent");
			var oFlexController2 = FlexControllerFactory.create("myComponent");

			assert.strictEqual(oFlexController1, oFlexController2);
		});

		QUnit.test("propagates even if there are no changes for the component", function (assert) {
			sandbox.stub(ChangePersistence.prototype, "loadChangesMapForComponent").resolves({});
			sandbox.stub(Utils, "isApplicationComponent").returns(true);

			var oComponent = {
				getManifestObject: function () {
					return {
						"sap.app": {
							id: "componentId"
						}
					};
				},
				addPropagationListener: function () {},
				setModel: function () {},
				getId: function() {},
				getComponentData: function() {}
			};

			var oAddPropagationListenerStub = sandbox.stub(oComponent, "addPropagationListener");
			sandbox.stub(Utils, "getComponentClassName")
			.callThrough()
			.withArgs(oComponent)
			.returns("mockName");

			return FlexControllerFactory.getChangesAndPropagate(oComponent, {asyncHints: true})
			.then(function () {
				assert.equal(oAddPropagationListenerStub.callCount, 1, "propagation was triggered");
				assert.equal(this.oInitializeStub.callCount, 1, "FlexState was initialized");
				assert.ok(this.oInitializeStub.calledWith({
					componentId: oComponent.getId(),
					asyncHints: true
				}), "FlexState was initialized with the correct parameters");
			}.bind(this));
		});

		QUnit.test("does propagate if there are changes for the component", function (assert) {
			assert.expect(0); // assert only the addPropagationListener to be called

			var mDeterminedChanges = {
				someId: [{}]
			};

			var oComponent = {
				getManifestObject: function () {
					return {};
				},
				addPropagationListener: function () {
				},
				getManifest: function () {},
				setModel: function () {},
				getId: function() {},
				getComponentData: function() {}
			};

			sandbox.stub(ChangePersistence.prototype, "loadChangesMapForComponent").returns(Promise.resolve(function() {return mDeterminedChanges;}));
			sandbox.stub(Utils, "isApplicationComponent").returns(true);
			sandbox.stub(Utils, "getComponentClassName")
			.callThrough()
			.withArgs(oComponent)
			.returns("mockName");

			return FlexControllerFactory.getChangesAndPropagate(oComponent, {});
		});

		QUnit.test("when getChangesForPropagate() is called for an embedded component with a preexisting VariantModel on it's application component", function (assert) {
			assert.expect(3);
			var oExistingModel = {id: "existingVariantModel"};
			var oAppComponent = {
				getModel: function (sModelName) {
					assert.strictEqual(sModelName, Utils.VARIANT_MODEL_NAME, "then variant model called on the app component");
					return oExistingModel;
				},
				addPropagationListener: function () {
					assert.notOk(true, "addPropagationListener shouldn't be called again for an app component");
				},
				getId: function() {},
				getComponentData: function() {}
			};

			var oComponent = {
				setModel: function (oModelSet, sModelName) {
					assert.strictEqual(sModelName, Utils.VARIANT_MODEL_NAME, "then VariantModel was set on the embedded component with the correct name");
					assert.deepEqual(oModelSet, oExistingModel, "then the correct model was set");
				},
				getManifestObject: function () {},
				addPropagationListener: function () {
					assert.notOk(true, "addPropagationListener shouldn't be called for an embedded component");
				},
				getId: function() {},
				getComponentData: function() {}
			};

			sandbox.stub(Utils, "isEmbeddedComponent").returns(true);
			sandbox.stub(Utils, "getAppComponentForControl").withArgs(oComponent).returns(oAppComponent);

			return FlexControllerFactory.getChangesAndPropagate(oComponent, {});
		});

		QUnit.test("when getChangesForPropagate() is called for an embedded component with no preexisting VariantModel on it's application component", function (assert) {
			assert.expect(4);
			var oAppComponent = new Component();
			sandbox.stub(Utils, "isApplication").returns(true);
			sandbox.stub(Utils, "getComponentClassName")
				.callThrough()
				.withArgs(oAppComponent)
				.returns("mockName");
			sandbox.spy(oAppComponent, "setModel");
			sandbox.spy(oAppComponent, "addPropagationListener");
			sandbox.stub(Utils, "isEmbeddedComponent").returns(true);
			sandbox.stub(ChangePersistence.prototype, "loadChangesMapForComponent").resolves(function() {});
			sandbox.stub(Applier, "applyAllChangesForControl");

			var oComponent = {
				setModel: function (oModelSet, sModelName) {
					assert.ok(oAppComponent.setModel.calledWith(sinon.match.instanceOf(VariantModel), Utils.VARIANT_MODEL_NAME), "then app component's VariantModel was set");
					assert.ok(oAppComponent.addPropagationListener.calledOnce, "then addPropagationListener was called for the app component");
					assert.strictEqual(sModelName, Utils.VARIANT_MODEL_NAME, "then VariantModel was set on the embedded component with the correct name");
				},
				getManifestObject: function () {},
				addPropagationListener: function () {
					assert.notOk(true, "addPropagationListener shouldn't be called for an embedded component");
				},
				getId: function() {},
				getComponentData: function() {}
			};
			sandbox.stub(Utils, "getAppComponentForControl").withArgs(oComponent).returns(oAppComponent);

			assert.notOk(oAppComponent.getModel(Utils.VARIANT_MODEL_NAME), "then initially no variant model exists for the app component");

			return FlexControllerFactory.getChangesAndPropagate(oComponent, {})
			.then(function () {
				oAppComponent.destroy();
			});
		});

		QUnit.test("when createForControl() is called for a non application type component", function (assert) {
			var oMockManifest = {
				id: "MockManifestId"
			};
			var oMockControl = {
				id: "MockControlId"
			};
			var oAppComponent = {
				getManifest: function () {
					return oMockManifest;
				}
			};
			var sMockComponentName = "MockCompName";
			var sMockComponentAppVersion = "1.23";

			sandbox.stub(Utils, "getAppComponentForControl").withArgs(oMockControl).returns(oAppComponent);
			sandbox.stub(Utils, "getComponentClassName")
			.withArgs(oAppComponent)
			.returns(sMockComponentName);

			sandbox.stub(Utils, "getAppVersionFromManifest")
			.withArgs(oMockManifest)
			.returns(sMockComponentAppVersion);

			sandbox.stub(FlexControllerFactory, "create");

			FlexControllerFactory.createForControl(oMockControl);

			assert.ok(FlexControllerFactory.create.calledWith(sMockComponentName, sMockComponentAppVersion), "then FlexController created with the correct component name and app version");
		});
	});

	QUnit.done(function() {
		jQuery("#qunit-fixture").hide();
	});
});