import React from 'react';
import { Link, navigate } from 'gatsby';
import { Header, Segment, Accordion, Statistic, Divider, Icon, SemanticICONS } from 'semantic-ui-react';

import { CrewMember } from '../../model/crew';
import { PlayerCrew } from '../../model/player';
import CONFIG from '../../components/CONFIG';
import { StatLabel } from '../../components/statlabel';
import { getCoolStats } from '../../utils/misc';
import { formatTierLabel, gradeToColor, printPortalStatus } from '../../utils/crewutils';

type CrewRankHighlightsProps = {
	crew: CrewMember;
	markdownRemark?: any;
	compact?: boolean;
};

export const CrewRankHighlights = (props: CrewRankHighlightsProps) => {
	const { crew, markdownRemark, compact } = props;

	if (compact) {
		return (
			<div style={{ textAlign: 'center' }}>
				<StatLabel title="Voyage rank" value={crew.ranks.voyRank} />
				<StatLabel title="Gauntlet rank" value={crew.ranks.gauntletRank} />
				<StatLabel title="Big book tier" value={formatTierLabel(crew)} />
				{crew.events && <StatLabel title="Events" value={crew.events} />}
				{markdownRemark && markdownRemark.frontmatter.events !== null && (
					<StatLabel title="Events" value={markdownRemark.frontmatter.events} />
				)}
			</div>
		);
	}

	return (
		<React.Fragment>
			<div style={{
				display: "flex",
				flexDirection: "row",
				justifyContent:"space-between",
				alignItems: "center",
				margin: "0.25em",
				marginBottom: 0,
				marginRight: 0,
				marginLeft: 0,
				flexWrap: "wrap"}}>
				<StatLabel
					title="Big Book Tier"
					size='jumbo'
					value={<div
						style={{
							fontWeight: "bold",
							color: gradeToColor(
								crew.bigbook_tier
							) ?? undefined,
						}}
					>
						{formatTierLabel(crew)}
					</div>}
				/>
				<StatLabel
					title="CAB Grade"
					size='jumbo'
					value={
						<div
							style={{
								fontWeight: "bold",
								color: gradeToColor(
									crew.cab_ov_grade as string
								) ?? undefined,
							}}
						>
							{crew.cab_ov_grade ?? '?'}
						</div>
					}
				/>
				<StatLabel title="Voyage Rank"
					value={rankLinker(false, crew.ranks.voyRank, crew.symbol, 'ranks.voyRank')}/>
				<StatLabel title="Gauntlet Rank"
					value={rankLinker(false, crew.ranks.gauntletRank, crew.symbol, 'ranks.gauntletRank')}/>
			</div>

			<div style={{
				display: "flex",
				margin: "0.25em",
				marginTop: 0,
				marginRight: 0,
				marginLeft: 0,
				flexDirection: "row",
				justifyContent:"space-between",
				alignItems: "center",
				flexWrap: "wrap"}}>

				<StatLabel
						title="CAB Rank"
						value={crew.cab_ov_rank ? rankLinker(false, crew.cab_ov_rank, crew.symbol, 'cab_ov', 'descending', 'rarity:'+crew.max_rarity) : '?'}
						/>
				<StatLabel title="CAB Rating" value={crew.cab_ov ?? '?'} />
				<StatLabel title="Portal"
					value={<>
						<div style={{color: crew.in_portal ? 'lightgreen': undefined, fontWeight: crew.in_portal ? 'bold' : undefined}}>
							{printPortalStatus(crew, true, false)}
						</div>
					</>} />
				{crew.events && <StatLabel title="Events" value={crew.events} />}
				{markdownRemark.frontmatter.events !== null && (
					<StatLabel title="Events" value={markdownRemark.frontmatter.events} />
				)}
			</div>
		</React.Fragment>
	);
};

type CrewRanksProps = {
	crew: CrewMember;
	myCrew?: PlayerCrew[];
};

export const CrewRanks = (props: CrewRanksProps) => {
	const { crew, myCrew } = props;
	const [showPane, setShowPane] = React.useState(false);
	const title = !!myCrew ? getMyCrewTitle(crew, myCrew) : getCoolStats(crew, false);
	return (
		<Accordion style={{ }}>
			<Accordion.Title
				active={showPane}
				onClick={() => setShowPane(!showPane)}
			>
				<Icon name={showPane ? 'caret down' : 'caret right' as SemanticICONS} />
				{!showPane && <>{title}</>}
				{showPane && (
					<React.Fragment>
						{!!myCrew ? 'Ranks on your roster' : 'All ranks'}, based on unboosted immortalized skills:
					</React.Fragment>
				)}
			</Accordion.Title>
			<Accordion.Content active={showPane}>
				{showPane && (
					<div style={{ marginBottom: '1em' }}>
						{renderOtherRanks()}
					</div>
				)}
			</Accordion.Content>
		</Accordion>
	);

	function renderOtherRanks(): JSX.Element {
		let v = [] as JSX.Element[];
		let g = [] as JSX.Element[];
		let b = [] as JSX.Element[];

		const skillName = (shortName: string) => {
			let ns = CONFIG?.SKILLS_SHORT?.find(c => c.short === shortName)?.name;
			if (ns) return CONFIG.SKILLS[ns];
			else return null;
		}

		const rankHandler = (rank: string) => myCrew
			? myCrew.filter(c => c.ranks[rank] && crew.ranks[rank] > c.ranks[rank]).length + 1
			: crew.ranks[rank];

		const tripletHandler = (rank: string) => myCrew
			? myCrew.filter(c => c.ranks[rank] &&
			c.ranks[rank].name == crew.ranks[rank].name &&
			crew.ranks[rank].rank > c.ranks[rank].rank).length + 1
			: crew.ranks[rank].rank;

		// Need to filter by skills first before sorting by voyage triplet
		const tripletFilter = crew.ranks.voyTriplet
								? crew.ranks.voyTriplet.name.split('/')
									.map((s: string) => 'skill:'+s.trim())
									.reduce((prev: string, curr: string) => prev+' '+curr)
								: '';

		for (let rank in crew.ranks) {
			if (rank.startsWith('V_')) {
				v.push(
					<Statistic key={rank}>
						<Statistic.Label>{rank.slice(2).replace('_', ' / ')}</Statistic.Label>
						<Statistic.Value>{rankLinker(!!myCrew, rankHandler(rank), crew.symbol, 'ranks.'+rank)}</Statistic.Value>
					</Statistic>
				);
			} else if (rank.startsWith('G_')) {
				g.push(
					<Statistic key={rank}>
						<Statistic.Label>{rank.slice(2).replace('_', ' / ')}</Statistic.Label>
						<Statistic.Value>{rankLinker(!!myCrew, rankHandler(rank), crew.symbol, 'ranks.'+rank)}</Statistic.Value>
					</Statistic>
				);
			} else if (rank.startsWith('B_') && crew.ranks[rank]) {
				b.push(
					<Statistic key={rank}>
						<Statistic.Label>{skillName(rank.slice(2))}</Statistic.Label>
						<Statistic.Value>{rankLinker(!!myCrew, rankHandler(rank), crew.symbol, CONFIG.SKILLS_SHORT.find(c => c.short === rank.slice(2))?.name ?? "", 'descending')}</Statistic.Value>
					</Statistic>
				);
			}
		}

		return (
			<React.Fragment>
				<Segment>
					<Header as="h5">Base ranks</Header>
					<Statistic.Group widths="three" size={'mini'} style={{ paddingBottom: '0.5em' }}>
						{b}
					</Statistic.Group>
				</Segment>
				<Segment>
					<Header as="h5">Voyage skill ranks</Header>
					{crew.ranks.voyTriplet && (
						<React.Fragment>
							<Statistic.Group widths="one" size={'mini'}>
								<Statistic>
									<Statistic.Label>{crew.ranks.voyTriplet.name}</Statistic.Label>
									<Statistic.Value>{rankLinker(!!myCrew, tripletHandler('voyTriplet'), crew.symbol, 'ranks.voyRank', 'ascending', tripletFilter)}</Statistic.Value>
								</Statistic>
							</Statistic.Group>
							<Divider />
						</React.Fragment>
				)}
					<Statistic.Group widths="three" size={'mini'} style={{ paddingBottom: '0.5em' }}>
						{v}
					</Statistic.Group>
				</Segment>
				<Segment>
					<Header as="h5">Gauntlet pair ranks</Header>
					<Statistic.Group widths="three" size={'mini'} style={{ paddingBottom: '0.5em' }}>
						{g}
					</Statistic.Group>
				</Segment>
			</React.Fragment>
		);
	}

	function getMyCrewTitle(crew: CrewMember, roster: PlayerCrew[]): string {
		let skillCount = Object.entries(crew.base_skills).length;
		const rankHandler = (prefix: string) => {
			let [name, rank] = Object.entries(crew.ranks)
				.filter(([k, v]) => k.startsWith(prefix))
				.map(([k, v]) => [k, roster.filter((c) => c.ranks[k] < crew.ranks[k]).length + 1])
				.sort(([k1, v1], [k2, v2]) => (v1 as number) - (v2 as number))[0];
			return [
				(name as string).slice(2).replace('_', '/'),
				rank
			];
		}

		if (skillCount == 3) {
			let rank = roster.filter((c) =>
				c.ranks.voyTriplet &&
				c.ranks.voyTriplet.name == crew.ranks.voyTriplet?.name &&
				crew.ranks.voyTriplet.rank > c.ranks.voyTriplet.rank).length + 1

			return `#${rank} ${crew.ranks.voyTriplet?.name} on your roster`;
		} else if (skillCount == 2) {
			let [voyRankName, voyRank] = rankHandler('V');
			let [gauntRankName, gauntRank] = rankHandler('G');

			if (voyRank < gauntRank)
				return `#${voyRank} ${voyRankName} voyage pair in your roster`;
			else if (voyRank > gauntRank)
				return `#${gauntRank} ${gauntRankName} gauntlet pair in your roster`;
			else
				return `#${voyRank} ${voyRankName} voyage/gauntlet pair in your roster`;
		} else {
			let [baseName, baseRank] = rankHandler('B');
			return `#${baseRank} ${baseName} base in your roster`;
		}
	}
};

const rankLinker = (roster: boolean, rank: number, symbol: string, column: string, direction: string = 'ascending', search: string | undefined = undefined) => {
	return (<>{rank}</>);
	// Links temporarily disabled
	if (roster) return (<>{rank}</>);
	const linkState = {
		search: search ?? '',
		column: column,
		direction: direction ?? 'ascending',
		highlight: symbol ?? ''
	};
	const baseUrl = '/';
	let params = '';
	Object.entries(linkState).forEach(entry => {
		if (entry[1] !== '') {
			if (params !== '') params += '&';
			params += entry[0]+'='+encodeURI(entry[1]);
		}
	});
	const url = params !== '' ? baseUrl+'?'+params : baseUrl;
	return (
		<Link to={url} onClick={(event) => clickLink(event)}>{rank}</Link>
	);

	// On left clicks, use state instead of URL params because it's a little faster and cleaner
	function clickLink(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
		if (e.button === 0) {
			e.preventDefault();
			navigate(baseUrl, { state: linkState });
		}
	}
};
