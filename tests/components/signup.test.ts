/** Creating an account asks for the password twice, and says so before it asks the server. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn(async (..._args: unknown[]) => {}) }));
vi.mock('$lib/data/session', () => ({ signUp }));

import Signup from '../../src/routes/signup/+page.svelte';

async function fill(email: string, password: string, confirm: string) {
  await fireEvent.input(screen.getByLabelText('Email'), { target: { value: email } });
  await fireEvent.input(screen.getByLabelText('Password'), { target: { value: password } });
  await fireEvent.input(screen.getByLabelText('Confirm password'), { target: { value: confirm } });
  await fireEvent.submit(screen.getByRole('form', { name: 'Create an account' }));
}

describe('sign-up', () => {
  beforeEach(() => signUp.mockClear());

  it('has a confirm field', () => {
    render(Signup);
    expect(screen.getByLabelText('Confirm password')).toBeTruthy();
  });

  it('refuses two passwords that differ, without calling the server', async () => {
    render(Signup);
    await fill('a@b.co', 'longenough1', 'longenough2');
    expect((await screen.findByRole('alert')).textContent).toMatch(/do not match/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('refuses a short password even when both agree', async () => {
    render(Signup);
    await fill('a@b.co', 'short', 'short');
    expect((await screen.findByRole('alert')).textContent).toMatch(/at least 8/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('goes ahead when they match', async () => {
    render(Signup);
    await fill('a@b.co', 'longenough1', 'longenough1');
    await screen.findByRole('status');
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp.mock.calls[0]).toEqual(['a@b.co', 'longenough1', expect.stringContaining('/login')]);
  });

  it('shows how strong the password is as it is typed', async () => {
    const { container } = render(Signup);
    const meter = container.querySelector('.meter')!;
    expect(meter.classList.contains('shown')).toBe(false);
    await fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'password1' } });
    expect(meter.textContent).toMatch(/too weak/i);
    await fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'quiet Tavern bard 7 rolls!' } });
    expect(meter.textContent).toMatch(/strong/i);
    expect(meter.getAttribute('data-score')).toBe('4');
  });

  it('refuses a password everyone tries first', async () => {
    render(Signup);
    await fill('a@b.co', 'password123', 'password123');
    expect((await screen.findByRole('alert')).textContent).toMatch(/too easy to guess/i);
    expect(signUp).not.toHaveBeenCalled();
  });
});
