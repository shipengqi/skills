# Angular Reactive Forms — Advanced Patterns

## Cross-Field Validation

```ts
const passwordGroup = this.fb.nonNullable.group({
  password: ['', [Validators.required, Validators.minLength(8)]],
  confirm: ['', Validators.required],
}, { validators: passwordMatchValidator });

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return pass === confirm ? null : { passwordMismatch: true };
}

// Show error in template
@if (passwordGroup.hasError('passwordMismatch') && passwordGroup.touched) {
  <span role="alert">Passwords must match</span>
}
```

## Conditional Fields

```ts
const form = this.fb.group({
  type: ['personal' as 'personal' | 'business'],
  companyName: [{ value: '', disabled: true }, Validators.required],
});

// React to type changes
this.form.controls.type.valueChanges.subscribe(type => {
  const ctrl = this.form.controls.companyName;
  if (type === 'business') {
    ctrl.enable();
  } else {
    ctrl.disable();
    ctrl.reset();
  }
});
```

## Reusable Sub-Form as Component

```ts
// address-form.component.ts — implements ControlValueAccessor
@Component({
  selector: 'app-address-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: AddressFormComponent, multi: true }],
})
export class AddressFormComponent implements ControlValueAccessor {
  form = this.fb.nonNullable.group({
    street: ['', Validators.required],
    city: ['', Validators.required],
    zip: ['', Validators.pattern(/^\d{5}$/)],
  });

  writeValue(val: Address | null): void { if (val) this.form.setValue(val); }
  registerOnChange(fn: (v: Address) => void): void {
    this.form.valueChanges.subscribe(fn);
  }
  registerOnTouched(fn: () => void): void { /* wire blur events */ }
}
```

## Form Value from Signal

```ts
// Convert entire form value to a signal (reacts on every valueChange)
formValue = toSignal(this.form.valueChanges, { initialValue: this.form.value });

// Computed validation state
isValid = computed(() => this.form.valid);
```

## Disabling Submit While Pending

```ts
isSubmitting = signal(false);

submit(): void {
  if (this.form.invalid || this.isSubmitting()) return;
  this.isSubmitting.set(true);
  this.service.save(this.form.getRawValue()).pipe(
    finalize(() => this.isSubmitting.set(false))
  ).subscribe({ next: () => this.router.navigate(['/success']) });
}
```
