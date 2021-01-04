import { merge, Observable } from 'rxjs';
import counter from './shared/counter';
import { map, startWith, switchMap, tap } from './shared/instrument';
import onReady from './shared/onReady';
import { default as createUI, Events, Update } from './ui';

export function createLogic(
  { increment, decrement, input, reset }: Events,
  { showValue, setButtonsEnabled, setInput }: Update
): Observable<string> {
  return reset.pipe(
    tap(() => {
      setButtonsEnabled(true);
      setInput('');
      showValue('');
    }),
    startWith(null),
    switchMap(() =>
      merge(
        input.pipe(tap(() => setButtonsEnabled(false))),
        counter(increment, decrement).pipe(map((count) => `${count}`))
      )
    )
  );
}

export default function main(): HTMLElement {
  const [ui, events, update] = createUI();
  const { showValue } = update;
  const logic = createLogic(events, update);

  logic.subscribe((v) => {
    showValue(v);
  });

  return ui;
}

onReady(main);
