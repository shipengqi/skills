---
name: angular-forms
description: Angular 17+ Typed Reactive Forms — FormBuilder, FormGroup, Validators, FormArray, and Signal integration. Use when building forms, adding validation, or reading form state reactively. Apply whenever user uses new FormGroup() without FormBuilder.nonNullable, reads form.value instead of getRawValue() for form submission, shows validation errors without checking .touched, or asks how to add and remove dynamic form fields with FormArray.
metadata:
  triggers:
    files:
      - '*.component.ts'
      - '*.component.html'
    keywords:
      - angular
      - reactive forms
      - FormBuilder
      - FormGroup
      - FormControl
      - Validators
      - FormArray
---

# Angular Forms

## Setup — Typed Reactive Forms

```ts
import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `...`,
})
export class LoginComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
}
```

Angular 14+ infers the group type automatically from the initial values and validators. The type of `form.value` is `{ email: string | null; password: string | null }`.

## Typed FormControl (nonNullable)

```ts
// Use nonNullable when the field should never be null (no reset-to-null)
form = this.fb.nonNullable.group({
  email:    ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
});
// Now form.getRawValue() returns { email: string; password: string }
```

Always use `getRawValue()` (not `value`) when submitting — it includes disabled controls.

## Template Binding

```html
<form [formGroup]="form" (ngSubmit)="submit()">
  <label>
    Email
    <input formControlName="email" type="email" />
    @if (form.controls.email.invalid && form.controls.email.touched) {
      @if (form.controls.email.hasError('required')) {
        <span role="alert">Email is required</span>
      }
      @if (form.controls.email.hasError('email')) {
        <span role="alert">Invalid email format</span>
      }
    }
  </label>

  <button type="submit" [disabled]="form.invalid || isSubmitting">
    Sign in
  </button>
</form>
```

## Submit Handler

```ts
isSubmitting = signal(false);

submit(): void {
  if (this.form.invalid) return;
  this.isSubmitting.set(true);

  this.authService.login(this.form.getRawValue()).subscribe({
    next: () => this.router.navigate(['/dashboard']),
    error: (err) => {
      this.form.setErrors({ serverError: err.message });
      this.isSubmitting.set(false);
    },
  });
}
```

## Custom Validator

```ts
// Sync validator
function noSpaces(control: AbstractControl): ValidationErrors | null {
  if (/\s/.test(control.value)) return { noSpaces: true };
  return null;
}

// Async validator (e.g. username availability)
function uniqueUsername(userService: UserService): AsyncValidatorFn {
  return (control) =>
    timer(300).pipe(
      switchMap(() => userService.checkUsername(control.value)),
      map(taken => (taken ? { usernameTaken: true } : null)),
      catchError(() => of(null))
    );
}

// Usage
new FormControl('', [Validators.required, noSpaces], [uniqueUsername(this.userService)])
```

## FormArray — Dynamic Fields

```ts
form = this.fb.group({
  name: ['', Validators.required],
  tags: this.fb.array<FormControl<string>>([]),
});

get tags() { return this.form.controls.tags; }

addTag(): void {
  this.tags.push(this.fb.nonNullable.control('', Validators.required));
}

removeTag(i: number): void { this.tags.removeAt(i); }
```

```html
<div formArrayName="tags">
  @for (tag of tags.controls; track $index; let i = $index) {
    <input [formControlName]="i" />
    <button type="button" (click)="removeTag(i)">Remove</button>
  }
</div>
<button type="button" (click)="addTag()">Add tag</button>
```

## Reading Form State with Signals

```ts
import { toSignal } from '@angular/core/rxjs-interop';

// Reactive form status as a Signal
emailInvalid = toSignal(
  this.form.controls.email.statusChanges.pipe(map(s => s === 'INVALID')),
  { initialValue: false }
);
```

## Anti-Patterns

- ❌ Template-driven forms for complex validation — use Reactive Forms
- ❌ `form.value` instead of `form.getRawValue()` — misses disabled controls
- ❌ Touching `form.controls` directly in template without null checks — use `form.get('field')!`
- ❌ Async validators without debounce — fires on every keystroke
- ❌ Reading `form.value.email` in submit without null-check — use typed nonNullable group

## Verification

1. Submit invalid form — field errors appear correctly
2. Submit valid form — `getRawValue()` returns typed, non-null values
3. `ng build --configuration production` — strict template type-check passes

## References

- [Reactive Forms](references/reactive-forms.md) — cross-field validation, conditional fields, form reuse
