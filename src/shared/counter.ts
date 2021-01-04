import { merge, Observable } from 'rxjs';
import { map, scan } from './instrument';

export default function counter(
  increment: Observable<unknown>,
  decrement: Observable<unknown>,
  startValue = 0
): Observable<number> {
  return merge(
    increment.pipe(map(() => 1)),
    decrement.pipe(map(() => -1))
  ).pipe(scan((acc, i) => acc + i, startValue));
}
