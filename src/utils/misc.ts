import CONFIG from '../components/CONFIG';
import { CrewMember } from '../model/crew';
import { AvatarIcon } from '../model/game-elements';
import { PlayerCrew } from '../model/player';

export interface DropDownItem {
	key: string;
	value: string;
	image: AvatarIcon;
	text: string;
	title?: string;
	content?: JSX.Element;
}

export function getCoolStats(crew: PlayerCrew | CrewMember, simple: boolean, showMore: boolean = true): string {
	let stats = [] as string[];

	const rankType = rank => {
		return rank.startsWith('V_') ? 'Voyage' : rank.startsWith('G_') ? 'Gauntlet' : 'Base';
	};
	
	const skillName = short => {
		let fskill = CONFIG.SKILLS_SHORT.find(c => c.short === short);
		return fskill ? CONFIG.SKILLS[fskill.name] : null;
	} 

	for (let rank in crew.ranks) {
		if (simple) {
			if (rank.startsWith('B_')) {
				if (crew.ranks[rank] && crew.ranks[rank] <= 40) {
					stats.push(`${rank.slice(2)} #${crew.ranks[rank]}`);
				}
			}
		} else {
			if (rank.startsWith('V_') || rank.startsWith('G_') || rank.startsWith('B_')) {
				if (crew.ranks[rank] && crew.ranks[rank] <= 9) {
					stats.push(`${rankType(rank)} #${crew.ranks[rank]} ${rank.slice(2).replace('_', ' / ')}`);
				}
			}
			if (rank === 'voyTriplet') {
				if (crew.ranks[rank] && (crew.ranks.voyTriplet?.rank ?? 0) <= 9)
					stats.push(`Voyage #${crew.ranks.voyTriplet?.rank} ${crew.ranks.voyTriplet?.name}`);
			}
		}
	}

	if (simple) {
		stats.push(`Voyages #${crew.ranks.voyRank}`);
		return stats.join(' | ');
	} else {
		if (stats.length === 0) {
			return showMore ? 'Show detailed ranks and stats...': '';
		} else {
			return stats.join(', ') + (showMore ? ', more stats...' : '');
		}
	}
}

export interface ExportField {
	label: string;
	value: (row: any) => any;
}

export function simplejson2csv<T>(data: T[], fields: ExportField[], delimeter = ',') {
	const escape = (val: string) => '"' + String(val).replace(/"/g, '""') + '"';

	let csv = fields.map(f => escape(f.label)).join(delimeter);
	for (let row of data) {
		let rowData = [] as string[];
		for (let field of fields) {
			try {
				rowData.push(escape(field.value(row)));
			} catch (er) {
				console.error(er);
				console.log(row);
			}
		}

		csv += '\r\n' + rowData.join(delimeter);
	}

	return csv;
}


/**
 * Creates a formatted title (appelation) from the given text.
 * @param text The text to convert into a title
 * @returns 
 */
export function appelate(text: string) {
	let curr: string = "";
	let cpos = 0;

	const match = new RegExp(/[A-Za-z0-9]/);

	for (let ch of text) {
		if (match.test(ch)) {
			if (cpos++ === 0) {
				curr += ch.toUpperCase();
			}
			else {
				curr += ch.toLowerCase();
			}
		}
		else {
			cpos = 0;
			curr += ch == '_' ? " " : ch;
		}
	}

	return curr;
}

export const getImageName = (reward) => {
	let img = reward.icon?.file.replace(/\//g, '_');
	if (img.slice(0, 1) === '_') img = img.slice(1); else img = '/atlas/' + img;
	if (img.slice(-4) !== '.png') img += '.png';
	return img;
};


	
/** Check if the device, itself, (not the resolution) is a mobile device */
export const mobileCheck = function() {
	if (typeof navigator === 'undefined' || typeof navigator.userAgent === 'undefined') return false;
	let check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||window["opera"]);
	return check || iOS();
};

function iOS() {
	if (typeof navigator === 'undefined' || typeof navigator.userAgent === 'undefined') return false;
	return [
	  'iPad Simulator',
	  'iPhone Simulator',
	  'iPod Simulator',
	  'iPad',
	  'iPhone',
	  'iPod'
	].includes(navigator.platform)
	// iPad on iOS 13 detection
	|| (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  }


  export function makeAllCombos<T>(source: T[], current?: T[][], index?: number): T[][] {
	current ??= [];
	index ??= 0;

	let i = 0;
	let c = current.length;
	let newc = [ ...current ];
	
	newc.push([source[index]]);
	
	for (i = 0; i < c; i++) {
		newc.push([...current[i], source[index]]);		
	}
	
	current = newc;
	
	if (index < source.length - 1) {
		current = makeAllCombos(source, current, index + 1);
	}

	return current;
  }

  export function arrayUnion<T>(arr1: T[], arr2: T[]): T[] {
	let newarr = [...arr1];
	for (let elem of arr2) {
		if (!newarr.includes(elem)) {
			newarr.push(elem);
		}
	}
	return newarr;
  }

  export function arraysUnion<T>(arr: T[][]) {
	let newarr = [ ... arr[0] ];

	let c = arr.length;
	for (let i = 1; i < c; i++) {
		newarr = arrayUnion(newarr, arr[i]);
	}

	return newarr;
  }