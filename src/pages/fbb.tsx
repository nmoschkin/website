import React from 'react';

import { GlobalContext } from '../context/globalcontext';
import DataPageLayout from '../components/page/datapagelayout';

import { PlayerBossBattle } from '../components/fleetbossbattles/player';
import { NonPlayerBossBattle } from '../components/fleetbossbattles/nonplayer';

const FleetBossBattlesPage = () => {
	const globalContext = React.useContext(GlobalContext);
	const { playerData } = globalContext.player;

	const dbid = playerData?.player.dbid ?? '';

	return (
		<DataPageLayout
			pageTitle='Fleet Boss Battles'
			pageDescription='Use this tool to help activate combo chain bonuses in a fleet boss battle.'
			playerPromptType='require'
		>
			<React.Fragment>
				{!!playerData && <PlayerBossBattle dbid={`${dbid}`} />}
				{/* {!playerData && <NonPlayerBossBattle />} */}
			</React.Fragment>
		</DataPageLayout>
	);
};

export default FleetBossBattlesPage;
