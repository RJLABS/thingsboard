///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnInit,
  Output,
  Renderer2,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validator,
  ValidatorFn,
  Validators
} from '@angular/forms';
import {
  IotSvgProperty,
  IotSvgPropertyType,
  iotSvgPropertyTypes,
  iotSvgPropertyTypeTranslations
} from '@home/components/widget/lib/svg/iot-svg.models';
import { deepClone } from '@core/utils';
import { MatButton } from '@angular/material/button';
import { TbPopoverService } from '@shared/components/popover.service';
import { constantColor, Font } from '@shared/models/widget-settings.models';
import {
  ScadaSymbolPropertyPanelComponent
} from '@home/pages/scada-symbol/metadata-components/scada-symbol-property-panel.component';
import {
  ScadaSymbolPropertiesComponent
} from '@home/pages/scada-symbol/metadata-components/scada-symbol-properties.component';

export const propertyValid = (property: IotSvgProperty): boolean => !(!property.id || !property.name || !property.type);

export const defaultPropertyValue = (type: IotSvgPropertyType): any => {
  switch (type) {
    case IotSvgPropertyType.text:
      return '';
    case IotSvgPropertyType.number:
      return 0;
    case IotSvgPropertyType.switch:
      return false;
    case IotSvgPropertyType.color:
      return '#000';
    case IotSvgPropertyType.color_settings:
      return constantColor('#000');
    case IotSvgPropertyType.font:
      return {
        size: 12,
        sizeUnit: 'px',
        family: 'Roboto',
        weight: 'normal',
        style: 'normal',
        lineHeight: '1'
      } as Font;
    case IotSvgPropertyType.units:
      return '';
  }
};

@Component({
  selector: 'tb-scada-symbol-metadata-property-row',
  templateUrl: './scada-symbol-property-row.component.html',
  styleUrls: ['./scada-symbol-property-row.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ScadaSymbolPropertyRowComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => ScadaSymbolPropertyRowComponent),
      multi: true
    }
  ],
  encapsulation: ViewEncapsulation.None
})
export class ScadaSymbolPropertyRowComponent implements ControlValueAccessor, OnInit, Validator {

  @ViewChild('idInput')
  idInput: ElementRef<HTMLInputElement>;

  @ViewChild('editButton')
  editButton: MatButton;

  iotSvgPropertyTypes = iotSvgPropertyTypes;
  iotSvgPropertyTypeTranslations = iotSvgPropertyTypeTranslations;

  @Input()
  disabled: boolean;

  @Input()
  index: number;

  @Input()
  booleanPropertyIds: string[];

  @Output()
  propertyRemoved = new EventEmitter();

  propertyRowFormGroup: UntypedFormGroup;

  modelValue: IotSvgProperty;

  private propagateChange = (_val: any) => {};

  constructor(private fb: UntypedFormBuilder,
              private cd: ChangeDetectorRef,
              private popoverService: TbPopoverService,
              private renderer: Renderer2,
              private viewContainerRef: ViewContainerRef,
              private propertiesComponent: ScadaSymbolPropertiesComponent) {
  }

  ngOnInit() {
    this.propertyRowFormGroup = this.fb.group({
      id: [null, [this.propertyIdValidator()]],
      name: [null, [Validators.required]],
      type: [null, [Validators.required]]
    });
    this.propertyRowFormGroup.valueChanges.subscribe(
      () => this.updateModel()
    );
    this.propertyRowFormGroup.get('type').valueChanges.subscribe((newType: IotSvgPropertyType) => {
      this.onTypeChanged(newType);
    });
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.propertyRowFormGroup.disable({emitEvent: false});
    } else {
      this.propertyRowFormGroup.enable({emitEvent: false});
    }
  }

  writeValue(value: IotSvgProperty): void {
    this.modelValue = value;
    this.propertyRowFormGroup.patchValue(
      {
        id: value?.id,
        name: value?.name,
        type: value?.type
      }, {emitEvent: false}
    );
    this.cd.markForCheck();
  }

  editProperty($event: Event, matButton: MatButton, add = false, editCanceled = () => {}) {
    if ($event) {
      $event.stopPropagation();
    }
    const trigger = matButton._elementRef.nativeElement;
    if (this.popoverService.hasPopover(trigger)) {
      this.popoverService.hidePopover(trigger);
    } else {
      const ctx: any = {
        isAdd: add,
        booleanPropertyIds: this.booleanPropertyIds,
        property: deepClone(this.modelValue)
      };
      const scadaSymbolPropertyPanelPopover = this.popoverService.displayPopover(trigger, this.renderer,
        this.viewContainerRef, ScadaSymbolPropertyPanelComponent, ['leftOnly', 'leftTopOnly', 'leftBottomOnly'], true, null,
        ctx,
        {},
        {}, {}, true);
      scadaSymbolPropertyPanelPopover.tbComponentRef.instance.popover = scadaSymbolPropertyPanelPopover;
      scadaSymbolPropertyPanelPopover.tbComponentRef.instance.propertySettingsApplied.subscribe((property) => {
        scadaSymbolPropertyPanelPopover.hide();
        this.propertyRowFormGroup.patchValue(
          {
            id: property.id,
            name: property.name,
            type: property.type
          }, {emitEvent: false}
        );
        this.modelValue = property;
        this.propagateChange(this.modelValue);
      });
      scadaSymbolPropertyPanelPopover.tbDestroy.subscribe(() => {
        if (!propertyValid(this.modelValue)) {
          editCanceled();
        }
      });
    }
  }

  focus() {
    this.idInput.nativeElement.scrollIntoView();
    this.idInput.nativeElement.focus();
  }

  onAdd(onCanceled: () => void) {
    this.idInput.nativeElement.scrollIntoView();
    this.editProperty(null, this.editButton, true, onCanceled);
  }

  public validate(c: UntypedFormControl) {
    const idControl = this.propertyRowFormGroup.get('id');
    if (idControl.hasError('propertyIdNotUnique')) {
      idControl.updateValueAndValidity({onlySelf: false, emitEvent: false});
    }
    if (idControl.hasError('propertyIdNotUnique')) {
      this.propertyRowFormGroup.get('id').markAsTouched();
      return {
        propertyIdNotUnique: true
      };
    }
    const property: IotSvgProperty = {...this.modelValue, ...this.propertyRowFormGroup.value};
    if (!propertyValid(property)) {
      return {
        property: true
      };
    }
    return null;
  }

  private propertyIdValidator(): ValidatorFn {
    return control => {
      if (!control.value) {
        return {
          required: true
        };
      }
      if (!this.propertiesComponent.propertyIdUnique(control.value, this.index)) {
        return {
          propertyIdNotUnique: true
        };
      }
      return null;
    };
  }

  private onTypeChanged(newType: IotSvgPropertyType) {
    this.modelValue = {...this.modelValue, ...{type: newType}};
    this.modelValue.default = defaultPropertyValue(newType);
  }

  private updateModel() {
    const value: IotSvgProperty = this.propertyRowFormGroup.value;
    this.modelValue = {...this.modelValue, ...value};
    this.propagateChange(this.modelValue);
  }

}
