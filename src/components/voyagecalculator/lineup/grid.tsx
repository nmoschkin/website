import React from "react";
import { POPUP_DELAY, SHOW_SHIP_FINDER, ViewContext, ViewProps } from "./context";
import { Grid, Table, Popup, Icon, SemanticICONS } from "semantic-ui-react";
import { GlobalContext } from "../../../context/globalcontext";
import { AvatarView } from "../../item_presenters/avatarview";
import { Aggregates } from "./aggregates";
import { AssignmentCard } from "./card";
import { CrewFinder } from "./crewfinder";

export const GridView = (props: ViewProps) => {
	const { voyageConfig, rosterType, ship, shipData, assignments } = React.useContext(ViewContext);
	const { layout } = props;
	const { t } = React.useContext(GlobalContext).localized;

	return (
		<React.Fragment>
			{renderShip()}
			{layout === 'grid-cards' &&
				<div>
					<Grid columns={6} doubling centered>
						{renderCards()}
					</Grid>
				</div>
			}
			{layout === 'grid-icons' &&
				<Grid doubling centered>
					{renderIcons()}
				</Grid>
			}

			<div style={{ marginTop: '2em' }}>
				<Aggregates layout={layout} />
			</div>
		</React.Fragment>
	);

	function renderShip(): JSX.Element {
		if (!ship) return (<></>);
		return (
			<Table celled selectable striped unstackable collapsing compact='very' style={{ margin: '0 auto 2em' }}>
				<Table.Body>
					<Table.Row>
						<Table.Cell width={5}>{t('ship.ship')}</Table.Cell>
						<Table.Cell width={8} style={{ fontSize: '1.1em' }}>
							<b>{ship.name}</b>
						</Table.Cell>
						<Table.Cell width={2} className='iconic' style={{ fontSize: '1.1em' }}>
							{SHOW_SHIP_FINDER && voyageConfig.state === 'pending' && rosterType === 'myCrew' &&
								<span style={{ cursor: 'help' }}>
									<Popup content={`On voyage selection screen, tap ${shipData.direction} ${shipData.index} times to select ship`} mouseEnterDelay={POPUP_DELAY} trigger={
										<span style={{ whiteSpace: 'nowrap' }}>
											<Icon name={`arrow ${shipData.direction}` as SemanticICONS} />{shipData.index}
										</span>
									} />
								</span>
							}
						</Table.Cell>
						<Table.Cell width={1} className='iconic'>
							{shipData.shipBonus > 0 &&
								<span style={{ cursor: 'help' }}>
									<Popup content={`+${shipData.shipBonus} AM`} mouseEnterDelay={POPUP_DELAY} trigger={<img src={`${process.env.GATSBY_ASSETS_URL}atlas/icon_antimatter.png`} style={{ height: '1em', verticalAlign: 'middle' }} className='invertibleIcon' />} />
								</span>
							}
						</Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table>
		);
	}

	function renderCards(): JSX.Element {
		return (
			<React.Fragment>
				{assignments.map((assignment, idx) => {
					return (
						<Grid.Column key={idx}>
							<AssignmentCard assignment={assignment} showSkills={false} />
						</Grid.Column>
					);
				})}
			</React.Fragment>
		);
	}

	function renderIcons(): JSX.Element {
		return (
			<React.Fragment>
				{assignments.map((assignment, idx) => {
					const { crew, name, trait, bestRank } = assignment;
					return (
						<Grid.Column key={idx}>
							<Popup mouseEnterDelay={POPUP_DELAY} trigger={
								<div style={{ cursor: 'help' }}>
									<AvatarView
										mode='crew'
										size={48}
										item={crew}
										partialItem={true}
									/>
								</div>
							}>
								<Popup.Content>
									<AssignmentCard assignment={assignment} showSkills={true} />
								</Popup.Content>
							</Popup>
							<div style={{ marginTop: '.3em', textAlign: 'center', fontSize: '1.1em' }}>
								{voyageConfig.state === 'pending' && <CrewFinder crew={crew} bestRank={bestRank} />}
							</div>
						</Grid.Column>
					);
				})}
			</React.Fragment>
		);
	}
};
