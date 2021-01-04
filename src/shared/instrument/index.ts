/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueueingSubject } from 'queueing-subject';
import {
  MonoTypeOperatorFunction,
  Observable,
  ObservableInput,
  ObservedValueOf,
  OperatorFunction,
  SchedulerLike,
  Subscriber,
} from 'rxjs';
import * as RxOps from 'rxjs/operators';
import * as StackTrace from 'stacktrace-js';
import * as Event from './event';

declare global {
  interface Window {
    hook: Observable<any>;
  }
}

const sendTelemetry: Event.SendTelemetryFn = ((): Event.SendTelemetryFn => {
  if (typeof jest !== 'undefined') {
    return (): void => {
      /* Do Nothing */
    };
  }

  const hook = new QueueingSubject<Event.Event>();
  if (typeof window !== 'undefined') {
    window.hook = hook.asObservable();
  }

  const webSocket = new WebSocket('ws://localhost:9230');
  webSocket.onopen = (): void => {
    hook.subscribe((event) => {
      const json = JSON.stringify(Event.serialize(event));
      webSocket.send(json);
    });
  };

  return (event: Event.Event): void => {
    hook.next(event);
  };
})();

function hasLift(
  source: any
): source is { lift: InstanceType<typeof Observable>['lift'] } {
  return typeof source?.lift === 'function';
}

function operate<T, R>(
  init: (
    liftedSource: Observable<T>,
    subscriber: Subscriber<R>
  ) => (() => void) | void
): OperatorFunction<T, R> {
  return (source: Observable<T>): Observable<R> => {
    if (hasLift(source)) {
      return source.lift(function (
        this: Subscriber<R>,
        liftedSource: Observable<T>
      ) {
        try {
          return init(liftedSource, this);
        } catch (err) {
          this.error(err);
        }
      });
    }
    throw new TypeError('Unable to lift unknown Observable type');
  };
}

class TelemetrySubscriber<T> extends Subscriber<T> {
  private source: Promise<Event.EventSource>;

  constructor(
    private subscriber: Subscriber<T>,
    sourceLocation: Promise<StackTrace.StackFrame[]>,
    private sendTelemetry: Event.SendTelemetryFn
  ) {
    super(subscriber);
    this.source = sourceLocation.then(([, f]) => Event.sourceFromStackFrame(f));
    void this.source.then((source) => {
      sendTelemetry({ type: 'subscribe', source });
    });
  }

  _next(value: T): void {
    void this.source.then((source) =>
      sendTelemetry({ type: 'next', source, value: JSON.stringify(value) })
    );
    this.subscriber.next(value);
  }

  _complete(): void {
    void this.source.then((source) =>
      sendTelemetry({ type: 'completed', source })
    );
    this.subscriber.complete();
    this.unsubscribe(); // ensure tear down
  }

  _error(err: any): void {
    void this.source.then((source) =>
      sendTelemetry({ type: 'error', source, error: err })
    );
    this.subscriber.error(err);
    this.unsubscribe(); // ensure tear down
  }

  unsubscribe(): void {
    void this.source.then((source) =>
      this.sendTelemetry({ type: 'unsubscribe', source })
    );
    super.unsubscribe();
  }
}

export function map<T, R>(
  project: (value: T, index: number) => R
): OperatorFunction<T, R> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.map(project))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}

export function take<T>(n: number): MonoTypeOperatorFunction<T> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.take(n))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}

export function flatMap<T, O extends ObservableInput<any>>(
  project: (value: T, index: number) => O,
  concurrent?: number
): OperatorFunction<T, ObservedValueOf<O>> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.flatMap(project, concurrent))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}

export function switchMap<T, O extends ObservableInput<any>>(
  project: (value: T, index: number) => O
): OperatorFunction<T, ObservedValueOf<O>> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.switchMap(project))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}

export function distinctUntilChanged<T>(
  compare?: (x: T, y: T) => boolean
): MonoTypeOperatorFunction<T> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.distinctUntilChanged(compare))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}

export function tap<T>(
  next?: (x: T) => void,
  error?: (e: any) => void,
  complete?: () => void
): MonoTypeOperatorFunction<T> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.tap(next, error, complete))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}

export function startWith<T, D>(v1: D): OperatorFunction<T, T | D> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.startWith(v1))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}

export function scan<T>(
  accumulator: (acc: T, value: T, index: number) => T,
  seed?: T
): MonoTypeOperatorFunction<T>;
export function scan<T, R>(
  accumulator: (acc: R, value: T, index: number) => R,
  seed: R
): OperatorFunction<T, R> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.scan(accumulator, seed))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}

export function debounceTime<T>(
  dueTime: number,
  scheduler?: SchedulerLike
): MonoTypeOperatorFunction<T> {
  const sourceLocation = StackTrace.get();
  return operate((source, subscriber) => {
    source
      .pipe(RxOps.debounceTime(dueTime, scheduler))
      .subscribe(
        new TelemetrySubscriber(subscriber, sourceLocation, sendTelemetry)
      );
  });
}
