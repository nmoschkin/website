import React from 'react';
import { Loot, PlayerCrew, PlayerEquipmentItem, Reward } from "../../../model/player";
import { isMobile } from 'react-device-detect';
import { Grid, Header } from 'semantic-ui-react';
import { checkReward } from '../../../utils/itemutils';
import ItemDisplay from '../../itemdisplay';
import { GlobalContext } from '../../../context/globalcontext';


export interface VoyageStatsRewardsProps {
    playerItems?: PlayerEquipmentItem[];
    roster?: PlayerCrew[];
    rewards: Loot[] | Reward[]
}


export const VoyageStatsRewards = (props: VoyageStatsRewardsProps) => {
    const { playerItems, roster, rewards } = props;
    const globalContext = React.useContext(GlobalContext);
    const { items: allItems, crew: allCrew } = globalContext.core;
    const { playerData } = globalContext.player;

    rewards.sort((a, b) => {
        if (a.type == b.type && a.item_type === b.item_type && a.rarity == b.rarity)
            return a.full_name.localeCompare(b.full_name);
        else if (a.type == b.type && a.item_type === b.item_type)
            return b.rarity - a.rarity;
        else if (a.type == b.type)
            return b.item_type - a.item_type;
        else if (a.type == 2)
            return 1;
        else if (b.type == 2)
            return -1;
        return a.type - b.type;
    });

    const hideRarity = entry => entry.type == 3;
    const rarity = entry => entry.type == 1 ? 1 : entry.rarity;
    const getCrewSymbol = entry => entry.type == 1 ? entry.symbol : entry.symbol;
    const assetURL = file => {
        let url = file === 'energy_icon'
            ? 'atlas/energy_icon.png'
            : `${file.substring(1).replaceAll('/', '_')}`;

        if (!url.match(/\.png$/))
            url += '.png'
        return `${process.env.GATSBY_ASSETS_URL}${url}`;
    };

    const itemsOwned = item => {
        const pItem = playerItems?.find(i => i.symbol == item.symbol);
        return `(Have ${pItem ? (pItem?.quantity ?? 0) > 1000 ? `${Math.floor((pItem.quantity ?? 0) / 1000)}k+` : pItem.quantity : 0})`;
    };
    const ownedFuncs = [
        item => '',
        item => {
            const owned = roster?.filter(c => c.symbol == item.symbol);

            for (const c of owned ?? [])
                if (c.rarity < c.max_rarity)
                    return '(Fusable)';

            return (owned?.length ?? 0) > 0 ? '(Duplicate)' : '(Unowned)';
        },
        itemsOwned,
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        itemsOwned,	/* ship schematics */
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
        item => '',
    ];

    var me = this;

    return (
        <>
            <div>
                <Grid columns={isMobile ? 2 : 5} centered padded>
                    {rewards.map((reward: Reward, idx) => {
                        checkReward(allItems ?? [], reward);
                        return (
                            <Grid.Column key={idx}>
                                <Header
                                    style={{ display: 'flex' }}
                                    icon={
                                        <ItemDisplay
                                            quantity={reward.quantity}
                                            src={assetURL(reward.icon?.file)}
                                            size={48}
                                            rarity={rarity(reward)}
                                            maxRarity={reward.rarity}
                                            hideRarity={hideRarity(reward)}
                                            targetGroup={reward.type === 1 ? 'voyageRewards_crew' : 'voyageRewards_item'}
                                            itemSymbol={getCrewSymbol(reward)}
                                            allCrew={allCrew}
                                            allItems={allItems}
                                            playerData={playerData}
                                        />
                                    }
                                    content={reward.name}
                                    subheader={`Got ${reward.quantity?.toLocaleString()} ${ownedFuncs[reward.type] ? ownedFuncs[reward.type](reward) : reward.type}`}
                                />
                            </Grid.Column>
                        )
                    }
                    )}
                </Grid>
            </div>
        </>
    );
}

export interface VoyageStatsRewardTitleProps {
    roster?: PlayerCrew[];
    rewards: Loot[] | Reward[]
}

export const VoyageStatsRewardsTitle = (props: VoyageStatsRewardTitleProps): JSX.Element => {
    const { roster, rewards } = props;
    const globalContext = React.useContext(GlobalContext);
    const { t, tfmt } = globalContext.localized;
    const crewGained = rewards.filter(r => r.type === 1);
    const bestRarity = crewGained.length == 0 ? 0 : crewGained.map(c => c.rarity).reduce((acc, r) => Math.max(acc, r));
    const bestCrewCount = crewGained
        .filter(c => c.rarity == bestRarity)
        .map(c => c.quantity)
        .reduce((acc, c) => acc + c, 0);
    const chronReward = rewards.filter(r => r.symbol === 'energy');
    const chrons = chronReward.length == 0 ? 0 : chronReward[0].quantity;
    const honorReward = rewards.filter(r => r.symbol === 'honor');
    const honor = honorReward.length == 0 ? 0 : honorReward[0].quantity;
    let h = 0;
    if (roster?.length && crewGained?.length) {
        let duplicates = crewGained.filter((crew) => roster.some((rost) => rost.symbol === crew.symbol && rost.rarity === rost.max_rarity)).map((cg) => roster.find(r => r.symbol === cg.symbol)).filter(f => f) as PlayerCrew[];
        if (duplicates?.length) {
            for (let crew of duplicates) {
                if (crew.max_rarity === 5) {
                    h += 550;
                }
                else if (crew.max_rarity === 4) {
                    h += 200;
                }
                else if (crew.max_rarity === 3) {
                    h += 100;
                }
                else if (crew.max_rarity === 2) {
                    h += 50;
                }
                else {
                    h += 25;
                }
            }
        }
    }

    const dupeHonor = h + honor;

    return (
        <span>
            {`${t('base.rewards')}: ${bestCrewCount} ${bestRarity}* `}&nbsp;
            {` ${chrons.toLocaleString()} `}
            <img
                src={`${process.env.GATSBY_ASSETS_URL}atlas/energy_icon.png`}
                style={{ width: '16px', verticalAlign: 'text-bottom' }}
            />&nbsp;&nbsp;
            {` ${honor.toLocaleString()} `}
            <img
                src={`${process.env.GATSBY_ASSETS_URL}currency_honor_currency_0.png`}
                style={{ width: '16px', verticalAlign: 'text-bottom' }}
            />

            {dupeHonor && (
                <span> ({tfmt('voyage.or_n_h_if_dupes_dismissed', {
                    n: dupeHonor.toLocaleString(),
                    h: <img
                        src={`${process.env.GATSBY_ASSETS_URL}currency_honor_currency_0.png`}
                        style={{ width: '16px', verticalAlign: 'text-bottom' }}
                    />
                })})
                </span>
            )}
        </span>
    )
}