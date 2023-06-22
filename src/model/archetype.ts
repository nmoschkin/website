import { Icon } from "./game-elements"

export interface ArchetypeRoot20 {
    archetypes: Archetype20[]
}

export interface ArchetypeRoot17 {
    archetypes: Archetype17[]
}

export interface Archetype20 {
    id: number
    symbol: string
    type: string
    item_type: number
    name: string
    icon: Icon;
    flavor: string
    rarity: number
    recipe?: ArchetypeRecipe
    item_sources: ItemSource[]
    bonuses?: ArchetypeBonus
    short_name?: string
  }
  
  export interface Archetype17 {
    id: number
    symbol: string
    type: number;
    name: string
    icon: Icon;
    flavor: string
    rarity: number
    recipe?: ArchetypeRecipe
    item_sources: ItemSource[]
    bonuses?: ArchetypeBonus
    short_name?: string
  }
  
  export interface ArchetypeRecipe {
    demands: ArchetypeDemand[]
    validity_hash: string
  }
  
  export interface ArchetypeDemand {
    archetype_id: number
    count: number
  }
  
  export interface ItemSource {
    challenge_id?: number
    challenge_skill?: string
    challenge_difficulty?: number
    type: number
    id: number
    name: string
    energy_quotient: number
    chance_grade: number
    place?: string
    mission?: number
    dispute?: number
    mastery?: number
  }
  
  export interface ArchetypeBonus {
    [key: string]: number | undefined;
  }
  