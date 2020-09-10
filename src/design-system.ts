import {TemplateFormat, DesignSystemFeatureParams, DesignSystemPreprocessFunction, DesignSystemProcessFunction} from './interface';
import {DesignSystemFeature} from './design-system-feature';
import {format as prettierFormat} from 'prettier';
import {writeFileSync, readFileSync, existsSync, ensureDirSync} from 'fs-extra';
import {resolve, basename, dirname, sep, join} from 'path';
import {find} from 'globule';

export class DesignSystem {

  private readonly defaults: string = resolve(__dirname, './defaults');
  private readonly iconExtension = '.svg';
  private readonly templateExtension: TemplateFormat;

  private features: {[key:string]: DesignSystemFeature} = {};

  private static outputMsg = 'File automatically generated by Atomic Framework Design System engine';

  public entry: string;
  public output: string;

  public fonts: string = '';
  public cssVars: string = '';
  public sassMaps: string = '';
  public sassPlaceholders: string = '';

  public static featureExtension = '.json';
  public static descExtension = '.md';
  public static preprocessExtension = '.preprocess.js';
  public static processExtension = '.process.js';

  constructor(entry: string, output: string, templateType: TemplateFormat) {

    this.entry = resolve(process.cwd(), entry);
    this.output = resolve(process.cwd(), output);
    this.templateExtension = templateType;

    if(!existsSync(this.entry)) {
      console.log(`Entry Design System folder doesn't exists`);
      process.exit(1);
    }
  }

  public async setup() {
    await this.exploreFolder(this.defaults);
    // await this.exploreFolder(this.entry);
    this.getFonts();
    this.getCssVars();
    this.getSassMaps();
    this.getSassPlaceholders();
  }

  public async exploreFolder(entry: string = this.entry) {

    const features = find(`**/*${DesignSystem.featureExtension}`, {srcBase: this.entry, prefixBase: true});

    for (const feature of features) {
      const name = basename(feature, DesignSystem.featureExtension);
      const featureParams = await import(feature);
      const params: DesignSystemFeatureParams = {
        files: {
          params: feature,
        },
        // Get Design System Features params
        params: featureParams.default,
      }

      // Search for a Readme file
      const descPath = `${dirname(feature)}${sep}${name}${DesignSystem.descExtension}`;
      if (existsSync(descPath)) {
        params.files.desc = descPath;
        params.desc = readFileSync(descPath, {encoding: 'utf-8'});
      }

      // Search for a Process function file
      const preprocessPath = `${dirname(feature)}${sep}${name}${DesignSystem.preprocessExtension}`;
      if (existsSync(preprocessPath)) {
        params.files.preprocess = preprocessPath;
        const preprocess = await import(preprocessPath);
        params.preprocess = preprocess.default.default as DesignSystemPreprocessFunction;
      }

      // Search for a Process function file
      const processPath = `${dirname(feature)}${sep}${name}${DesignSystem.processExtension}`;
      if (existsSync(processPath)) {
        params.files.process = processPath;
        const process = await import(processPath);
        params.process = process.default.default as DesignSystemProcessFunction;
      }

      // Search for a Template file
      const templatePath = `${dirname(feature)}${sep}${name}${this.templateExtension}`;
      if (existsSync(templatePath)) {
        params.files.template = templatePath;
        params.template = readFileSync(templatePath, {encoding: 'utf-8'});
      }

      // Search for an Icons folder
      const iconsPath = join(dirname(feature), name);
      if (existsSync(iconsPath)) {
        params.files.icons = find(`${iconsPath}${sep}*${this.iconExtension}`);
      }

      this.setFeature(name, params);
    }
  }

  public getFeature(name: string): DesignSystemFeature | null {

    if(typeof this.features[name] !== 'undefined'){
      return this.features[name];
    }
    else {
      console.log(`There is no "${name}" feature in your Design System`);
      return null;
    }
  }

  public setFeature(namespace: string, params: DesignSystemFeatureParams) {

    if(typeof this.features[namespace] !== 'undefined') {
      console.log(`Feature "${namespace}" overrided`);
    }
    this.features[namespace] = new DesignSystemFeature(namespace, params, this.output);
  }

  public deleteFeature(namespace: string) {

    if(typeof this.features[namespace] !== 'undefined') {
      delete this.features[namespace];
      console.log(`Feature "${namespace}" deleted`);
    }
    else {
      console.log(`There is no "${namespace}" feature in your Design System`);
    }
  }

  public getFonts(): string {

    for(const [namespace, feature] of Object.entries(this.features)) {
      this.fonts += feature.exportFonts();
    }

    return this.fonts;
  };

  public getCssVars(): string {

    for(const [namespace, feature] of Object.entries(this.features)) {
      this.cssVars += feature.exportCssVars();
    }

    return this.cssVars;
  };

  public getSassMaps(): string {

    for(const [namespace, feature] of Object.entries(this.features)) {
      this.sassMaps += feature.exportSassMap();
    }

    return this.sassMaps;
  };

  public getSassPlaceholders(): string {

    for(const [namespace, feature] of Object.entries(this.features)) {
      this.sassPlaceholders += feature.exportSassPlaceholders();
    }

    return this.sassPlaceholders;
  };

  public writeCssFile() {

    const source = `
      /* ${DesignSystem.outputMsg} */
    
      :root {
        ${this.cssVars}
      }
    `;

    ensureDirSync(this.output);
    writeFileSync(`${this.output}${sep}design-system.css`, prettierFormat(source, {parser: 'css'}), {encoding: 'utf-8'});
  }

  public writeSassFile() {

    const source = `
      // ${DesignSystem.outputMsg}
      
      @import './design-system.css';
      
      ${this.fonts}
      
      /// Define @content from a specific semantic breakpoint
      /// @name breakpoint
      /// @group Core
      /// @param {string} $device Semantic breakpoint name string
      /// @param {map} $breakpointsSystem [$design-system-breakpoints] Sass map with semantic breakpoints names associated with their values
      
      @mixin breakpoint($device, $breakpoints-system:$DS-breakpoints) {
      
        @if map-has-key($breakpoints-system, $device) {
          @media (min-width: #{map-get($breakpoints-system, $device)}px) {
      
            @content;
          }
        }
        @else {
      
          @content;
        }
      }
      
      /// Define @content from a specific breakpoint
      /// @name tweakpoint
      /// @group Core
      /// @param {number} point Breakpoint value
      
      @mixin tweakpoint($point) {
      
        @media (min-width: $point) {
          @content;
        }
      }
      
      ${this.sassMaps}
      
      ${this.sassPlaceholders}
    `;

    ensureDirSync(this.output);
    writeFileSync(`${this.output}${sep}design-system.scss`, prettierFormat(source, {parser: 'scss'}), {encoding: 'utf-8'});
  }
}
