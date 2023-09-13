import '../../../typings/worker';
import UnifiedWorker from 'worker-loader!../../../workers/unifiedWorker';
import { IVoyageCrew } from '../../../model/voyage';
import { CalcResult, JohnJayBest } from '../../../model/worker';
import { CalculatorState } from './calchelpers';
import { HelperProps, Helper } from "./Helper";

export class USSJohnJayHelper extends Helper {
	readonly id: string;
	readonly calculator: string;
	readonly calcName: string;
	readonly calcOptions: any;

	constructor(props: HelperProps) {
		super(props);
		this.id = 'request-' + Date.now();
		this.calculator = 'ussjohnjay';
		this.calcName = 'Multi-vector Assault';
		this.calcOptions = {
			strategy: props.calcOptions?.strategy ?? 'estimate'
		};
	}

	start(): void {
		this.perf.start = performance.now();
		this.calcState = CalculatorState.InProgress;

		const USSJohnJayConfig = {
			voyage_description: this.voyageConfig,
			bestShip: this.bestShip,
			roster: this.consideredCrew,
			strategy: this.calcOptions.strategy,
			worker: 'ussjohnjay'
		};

		const worker = new UnifiedWorker();
		worker.addEventListener('message', message => {
			if (message.data.result) {
				const results = this._messageToResults(message.data.result);
				this.perf.end = performance.now();
				this.calcState = CalculatorState.Done;
				this.resultsCallback(this.id, results, CalculatorState.Done);
			}
		});
		worker.postMessage(JSON.parse(JSON.stringify(USSJohnJayConfig)));
		this.calcWorker = worker;
	}

	_messageToResults(bests: JohnJayBest[]): CalcResult[] {
		return bests.map((best, bestId) => {
			return {
				entries: best.crew.map((crew, entryId) => ({
					slotId: entryId,
					choice: this.consideredCrew.find(c => c.id === crew.id) ?? {} as IVoyageCrew,
					hasTrait: best.traits[entryId]
				})),
				estimate: best.estimate,
				aggregates: best.skills,
				startAM: best.estimate.antimatter
			} as CalcResult;
		});
	}
}
