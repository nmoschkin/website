import React from 'react';

import { GlobalContext } from '../../context/globalcontext';
import { NavItem, createSubMenu, renderSubmenuItem } from '../page/util';

type PlayerMenuProps = {
	requestPanel: (panel: string | undefined) => void;
	requestClearData: () => void;
	vertical?: boolean;
};

export const PlayerMenu = (props: PlayerMenuProps): JSX.Element => {
	const globalContext = React.useContext(GlobalContext);
	const {
		requestPanel,
		requestClearData,
	} = props;

	const { playerData } = globalContext.player;

	const playerMenu = [
		{
			title: "Import Player Data...",
			checkVisible: (data) => !playerData,
			customAction: (e, data) => requestPanel('input')
		},
		{
			title: "Update Player Data...",
			checkVisible: (data) => !!playerData,
			customAction: (e, data) => requestPanel('input')
		},
		{
			title: "Share Profile...",
			checkVisible: (data) => !!playerData,
			customAction: (e, data) => requestPanel('share')
		},
		{
			title: "About Me...",
			checkVisible: (data) => !!playerData,
			customAction: (e, data) => requestPanel('card')
		},
		{
			title: "My Achievements",
			link: "/playertools?tool=other"
		},
		{
			title: "My Charts & Stats",
			link: "/playertools?tool=charts"
		},
		{
			title: "Clear Player Data",
			checkVisible: (data) => !!playerData,
			customAction: (e, data) => requestClearData()
		},
	] as NavItem[];

	if (props.vertical) {
		return (
			<React.Fragment>
				{playerMenu.map((item) => {
					if (item.checkVisible && !item.checkVisible(item)) return <></>;
					return renderSubmenuItem(item);
				})}
			</React.Fragment>
		);
	}
	else {
		const items = playerMenu.filter(item => item.checkVisible ? item.checkVisible(item) : true);
		return createSubMenu(playerData?.player.character.display_name ?? '', items);
	}
};


/*
	function exportCrewTool() {
		let text = playerData?.player.character.unOwnedCrew ? exportCrew(playerData.player.character.crew.concat(playerData.player.character.unOwnedCrew)) : "";
		downloadData(`data:text/csv;charset=utf-8,${encodeURIComponent(text)}`, 'crew.csv');
	}

	function exportCrewToClipboard() {
		let text = playerData?.player.character.unOwnedCrew ? exportCrew(playerData.player.character.crew.concat(playerData.player.character.unOwnedCrew), '\t') : "";
		navigator.clipboard.writeText(text);
	}
*/
