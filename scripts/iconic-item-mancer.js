/**
 * Iconic Item Mancer for Marvel Multiverse RPG
 * A step-by-step wizard for creating Iconic Items in Foundry VTT v13
 */

class IconicItemMancer extends Application {
  constructor(options = {}) {
    super(options);
    
    this.state = {
      currentStep: 1,
      data: {
        name: "",
        description: "",
        origin: null,
        restrictions: [],
        specialPowers: [],
        regularPowers: [],
        weaponDetails: {
          isWeapon: false,
          meleeDamageMultiplier: "",
          agilityDamageMultiplier: "",
          meleeRange: "",
          agilityRange: ""
        }
      }
    };
    
    this.origins = [];
    this.restrictions = [];
    this.specialPowers = [];
  }
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "iconic-item-mancer",
      title: game.i18n.localize("ICONICITEMMANCER.Title"),
      template: "modules/iconic-item-mancer/templates/wizard.html",
      classes: ["iconic-item-mancer"],
      width: 900,
      height: 700,
      resizable: true,
      closeOnSubmit: false
    });
  }
  
  async getData() {
    const data = await super.getData();
    
    // Load data if not already loaded
    if (this.origins.length === 0) {
      await this.loadData();
    }
    
    data.currentStep = this.state.currentStep;
    data.state = this.state.data;
    data.origins = this.origins;
    data.restrictions = this.restrictions;
    data.specialPowers = this.specialPowers;
    data.powerValue = this.calculatePowerValue();
    
    // Add language detection
    data.lang = game.i18n.lang;
    
    return data;
  }
  
  async loadData() {
    try {
      // Load origins
      const originsResponse = await fetch("modules/iconic-item-mancer/data/origins.json");
      this.origins = await originsResponse.json();
      
      // Load restrictions
      const restrictionsResponse = await fetch("modules/iconic-item-mancer/data/restrictions.json");
      this.restrictions = await restrictionsResponse.json();
      
      // Load special powers
      const specialPowersResponse = await fetch("modules/iconic-item-mancer/data/special-powers.json");
      this.specialPowers = await specialPowersResponse.json();
      
      console.log("Iconic Item Mancer | Data loaded successfully");
    } catch (error) {
      console.error("Iconic Item Mancer | Error loading data:", error);
      ui.notifications.error("Failed to load Iconic Item Mancer data");
    }
  }
  
  calculatePowerValue() {
    const numPowers = this.state.data.specialPowers.length + this.state.data.regularPowers.length;
    const numRestrictions = this.state.data.restrictions.length;
    const powerValue = Math.max(1, numPowers - numRestrictions);
    return powerValue;
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    // Ensure html is jQuery object
    const $html = html instanceof jQuery ? html : $(html);
    
    // Navigation buttons
    $html.find(".btn-next").click(this._onNextStep.bind(this));
    $html.find(".btn-prev").click(this._onPrevStep.bind(this));
    $html.find(".btn-finish").click(this._onFinish.bind(this));
    $html.find(".btn-cancel").click(this._onCancel.bind(this));
    
    // Step 1: Basic Info
    $html.find("input[name='item-name']").change(this._onNameChange.bind(this));
    $html.find("textarea[name='item-description']").change(this._onDescriptionChange.bind(this));
    
    // Step 2: Origin
    $html.find(".origin-card").click(this._onOriginSelect.bind(this));
    
    // Step 3: Restrictions
    $html.find(".restriction-checkbox").change(this._onRestrictionToggle.bind(this));
    
    // Step 4: Special Powers
    $html.find(".special-power-checkbox").change(this._onSpecialPowerToggle.bind(this));
    $html.find(".weapon-checkbox").change(this._onWeaponToggle.bind(this));
    $html.find("input[name^='weapon-']").change(this._onWeaponDetailsChange.bind(this));
  }
  
  async _onNextStep(event) {
    event.preventDefault();
    
    // Validate current step
    if (!this._validateStep(this.state.currentStep)) {
      return;
    }
    
    this.state.currentStep++;
    await this.render(true);
  }
  
  async _onPrevStep(event) {
    event.preventDefault();
    this.state.currentStep--;
    await this.render(true);
  }
  
  _validateStep(step) {
    switch(step) {
      case 1:
        if (!this.state.data.name || this.state.data.name.trim() === "") {
          ui.notifications.warn(game.i18n.localize("ICONICITEMMANCER.Warnings.NameRequired"));
          return false;
        }
        break;
      case 2:
        if (!this.state.data.origin) {
          ui.notifications.warn(game.i18n.localize("ICONICITEMMANCER.Warnings.OriginRequired"));
          return false;
        }
        break;
    }
    return true;
  }
  
  _onNameChange(event) {
    this.state.data.name = event.target.value;
  }
  
  _onDescriptionChange(event) {
    this.state.data.description = event.target.value;
  }
  
  _onOriginSelect(event) {
    event.preventDefault();
    const originId = $(event.currentTarget).data("origin-id");
    this.state.data.origin = originId;
    
    // Update UI
    $(event.currentTarget).closest(".origins-grid").find(".origin-card").removeClass("selected");
    $(event.currentTarget).addClass("selected");
  }
  
  _onRestrictionToggle(event) {
    const restrictionId = $(event.target).data("restriction-id");
    const isChecked = event.target.checked;
    
    if (isChecked) {
      if (!this.state.data.restrictions.includes(restrictionId)) {
        this.state.data.restrictions.push(restrictionId);
      }
    } else {
      const index = this.state.data.restrictions.indexOf(restrictionId);
      if (index > -1) {
        this.state.data.restrictions.splice(index, 1);
      }
    }
    
    // Update power value display
    this._updatePowerValueDisplay();
  }
  
  _onSpecialPowerToggle(event) {
    const powerId = $(event.target).data("power-id");
    const isChecked = event.target.checked;
    
    if (isChecked) {
      if (!this.state.data.specialPowers.includes(powerId)) {
        this.state.data.specialPowers.push(powerId);
      }
    } else {
      const index = this.state.data.specialPowers.indexOf(powerId);
      if (index > -1) {
        this.state.data.specialPowers.splice(index, 1);
      }
    }
    
    // Update power value display
    this._updatePowerValueDisplay();
  }
  
  _onWeaponToggle(event) {
    this.state.data.weaponDetails.isWeapon = event.target.checked;
    
    // Show/hide weapon details
    const weaponDetailsSection = $(event.target).closest(".step-content").find(".weapon-details-section");
    if (event.target.checked) {
      weaponDetailsSection.show();
    } else {
      weaponDetailsSection.hide();
    }
  }
  
  _onWeaponDetailsChange(event) {
    const fieldName = event.target.name.replace("weapon-", "");
    this.state.data.weaponDetails[fieldName] = event.target.value;
  }
  
  _updatePowerValueDisplay() {
    const powerValue = this.calculatePowerValue();
    $(".power-value-display").text(powerValue);
  }
  
  async _onFinish(event) {
    event.preventDefault();
    
    // Validate all data
    if (!this._validateStep(this.state.currentStep)) {
      return;
    }
    
    // Create the item
    await this._createIconicItem();
    
    // Close the wizard
    this.close();
  }
  
  _onCancel(event) {
    event.preventDefault();
    this.close();
  }
  
  async _createIconicItem() {
    try {
      // Get origin data
      const originData = this.origins.find(o => o.id === this.state.data.origin);
      const originName = game.i18n.lang === "pt-BR" ? originData.namePtBR : originData.name;
      
      // Build description
      let fullDescription = `<h2>${game.i18n.localize("ICONICITEMMANCER.Labels.Origin")}: ${originName}</h2>`;
      fullDescription += `<p>${this.state.data.description}</p>`;
      
      // Add restrictions
      if (this.state.data.restrictions.length > 0) {
        fullDescription += `<h3>${game.i18n.localize("ICONICITEMMANCER.Labels.Restrictions")}</h3><ul>`;
        for (const restrictionId of this.state.data.restrictions) {
          const restriction = this.restrictions.find(r => r.id === restrictionId);
          const restrictionName = game.i18n.lang === "pt-BR" ? restriction.namePtBR : restriction.name;
          fullDescription += `<li><strong>${restrictionName}</strong></li>`;
        }
        fullDescription += `</ul>`;
      }
      
      // Add special powers
      if (this.state.data.specialPowers.length > 0) {
        fullDescription += `<h3>${game.i18n.localize("ICONICITEMMANCER.Labels.SpecialPowers")}</h3><ul>`;
        for (const powerId of this.state.data.specialPowers) {
          const power = this.specialPowers.find(p => p.id === powerId);
          const powerName = game.i18n.lang === "pt-BR" ? power.namePtBR : power.name;
          const powerDesc = game.i18n.lang === "pt-BR" ? power.descriptionPtBR : power.description;
          fullDescription += `<li><strong>${powerName}:</strong> ${powerDesc}</li>`;
        }
        fullDescription += `</ul>`;
      }
      
      // Add power value
      const powerValue = this.calculatePowerValue();
      fullDescription += `<h3>${game.i18n.localize("ICONICITEMMANCER.Labels.PowerValue")}: ${powerValue}</h3>`;
      
      // Create item data
      const itemData = {
        name: this.state.data.name,
        type: "weapon",
        img: "icons/svg/sword.svg",
        system: {
          description: fullDescription,
          origin: this.state.data.origin,
          powerValue: powerValue,
          isIconicItem: true
        }
      };
      
      // Add weapon details if applicable
      if (this.state.data.weaponDetails.isWeapon) {
        itemData.system.weaponDetails = this.state.data.weaponDetails;
      }
      
      // Create the item
      const item = await Item.create(itemData);
      
      ui.notifications.info(game.i18n.format("ICONICITEMMANCER.Messages.ItemCreated", {name: this.state.data.name}));
      
      // Show the item sheet
      item.sheet.render(true);
      
    } catch (error) {
      console.error("Iconic Item Mancer | Error creating item:", error);
      ui.notifications.error(game.i18n.localize("ICONICITEMMANCER.Errors.CreateFailed"));
    }
  }
}

// Initialize the module
Hooks.once("init", async () => {
  console.log("Iconic Item Mancer | Initializing module");
  
  // Register the application
  game.iconicItemMancer = {
    IconicItemMancer: IconicItemMancer
  };
  
  // Register Handlebars helpers
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => a > b);
  Handlebars.registerHelper("lt", (a, b) => a < b);
  Handlebars.registerHelper("includes", (array, value) => {
    if (!array || !Array.isArray(array)) return false;
    return array.includes(value);
  });
  
  // Preload Handlebars templates
  await loadTemplates([
    "modules/iconic-item-mancer/templates/wizard.html",
    "modules/iconic-item-mancer/templates/step-basic-info.html",
    "modules/iconic-item-mancer/templates/step-origin.html",
    "modules/iconic-item-mancer/templates/step-restrictions.html",
    "modules/iconic-item-mancer/templates/step-powers.html",
    "modules/iconic-item-mancer/templates/step-review.html"
  ]);
  
  console.log("Iconic Item Mancer | Templates preloaded");
});

// Add button to Items directory
Hooks.on("renderItemDirectory", (app, html, data) => {
  // Get the HTML element (v13 compatibility)
  const element = html instanceof HTMLElement ? html : html[0];
  
  // Check if button already exists
  if (element.querySelector(".iconic-item-mancer-button")) {
    return;
  }
  
  // Try v13 structure first
  let headerActions = element.querySelector(".header-actions");
  
  // Fallback to legacy structure
  if (!headerActions) {
    headerActions = element.querySelector(".action-buttons");
  }
  
  if (headerActions) {
    // Create button element
    const button = document.createElement("button");
    button.className = "iconic-item-mancer-button";
    button.title = game.i18n.localize("ICONICITEMMANCER.ButtonTitle");
    button.innerHTML = `<i class="fas fa-magic"></i> ${game.i18n.localize("ICONICITEMMANCER.ButtonLabel")}`;
    
    // Add click handler
    button.addEventListener("click", () => {
      new IconicItemMancer().render(true);
    });
    
    // Prepend button
    headerActions.insertBefore(button, headerActions.firstChild);
  }
});

console.log("Iconic Item Mancer | Module loaded");

