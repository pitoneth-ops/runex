const WIKI = "https://oldschool.runescape.wiki/w/Special:FilePath";

export type MonsterType = "melee" | "ranged" | "magic";
export type Weakness    = "melee" | "ranged" | "magic";

export interface MonsterDef {
  id:          string;
  name:        string;
  level:       number;
  hp:          number;
  atk:         number;
  def:         number;
  magic_def:   number;
  ranged_def:  number;
  type:        MonsterType;
  weakness:    Weakness;
  sprite:      string[];
  tokenReward: number;
}

export interface Phase {
  id:         number;
  name:       string;
  location:   string;
  difficulty: string;
  color:      string;
  bgColor:    string;
  monsters:   MonsterDef[];
}

export const PHASES: Phase[] = [
  {
    id: 1, name: "Phase 1", location: "Lumbridge", difficulty: "Beginner",
    color: "#6dde6d", bgColor: "rgba(109,222,109,0.08)",
    monsters: [
      { id:"chicken",  name:"Chicken",   level:1,  hp:3,   atk:1,   def:1,   magic_def:0,  ranged_def:0,  type:"melee", weakness:"melee",  sprite:[`${WIKI}/Chicken_chathead.png`],            tokenReward:80    },
      { id:"rat",      name:"Giant Rat", level:3,  hp:8,   atk:4,   def:2,   magic_def:1,  ranged_def:1,  type:"melee", weakness:"melee",  sprite:[`${WIKI}/Giant_rat_chathead.png`],           tokenReward:120   },
      { id:"goblin",   name:"Goblin",    level:5,  hp:5,   atk:3,   def:1,   magic_def:0,  ranged_def:1,  type:"melee", weakness:"ranged", sprite:[`${WIKI}/Goblin_chathead.png`],              tokenReward:150   },
    ],
  },
  {
    id: 2, name: "Phase 2", location: "Varrock", difficulty: "Easy",
    color: "#60a5fa", bgColor: "rgba(96,165,250,0.08)",
    monsters: [
      { id:"guard",      name:"Guard",      level:22, hp:28,  atk:18,  def:18,  magic_def:5,  ranged_def:5,  type:"melee", weakness:"magic",  sprite:[`${WIKI}/Guard_chathead.png`],               tokenReward:500   },
      { id:"hobgoblin",  name:"Hobgoblin",  level:28, hp:35,  atk:28,  def:15,  magic_def:5,  ranged_def:3,  type:"melee", weakness:"magic",  sprite:[`${WIKI}/Hobgoblin_chathead.png`],           tokenReward:700   },
      { id:"skeleton",   name:"Skeleton",   level:21, hp:22,  atk:22,  def:20,  magic_def:8,  ranged_def:8,  type:"melee", weakness:"magic",  sprite:[`${WIKI}/Skeleton_chathead.png`],            tokenReward:450   },
    ],
  },
  {
    id: 3, name: "Phase 3", location: "Stronghold", difficulty: "Medium",
    color: "#fbbf24", bgColor: "rgba(251,191,36,0.08)",
    monsters: [
      { id:"hill_giant", name:"Hill Giant",  level:28, hp:35,  atk:42,  def:28,  magic_def:10, ranged_def:10, type:"melee", weakness:"magic",  sprite:[`${WIKI}/Hill_giant_chathead.png`],          tokenReward:1500  },
      { id:"moss_giant", name:"Moss Giant",  level:42, hp:60,  atk:44,  def:40,  magic_def:8,  ranged_def:8,  type:"melee", weakness:"magic",  sprite:[`${WIKI}/Moss_giant_chathead.png`],          tokenReward:2000  },
      { id:"ice_warrior",name:"Ice Warrior", level:37, hp:43,  atk:38,  def:30,  magic_def:15, ranged_def:12, type:"melee", weakness:"ranged", sprite:[`${WIKI}/Ice_warrior_chathead.png`],         tokenReward:1800  },
    ],
  },
  {
    id: 4, name: "Phase 4", location: "Taverley Dungeon", difficulty: "Hard",
    color: "#c084fc", bgColor: "rgba(192,132,252,0.08)",
    monsters: [
      { id:"lesser_demon",  name:"Lesser Demon",  level:82,  hp:82,  atk:60,  def:60,  magic_def:25, ranged_def:20, type:"melee", weakness:"ranged", sprite:[`${WIKI}/Lesser_demon_chathead.png`],       tokenReward:5000  },
      { id:"fire_giant",    name:"Fire Giant",    level:86,  hp:111, atk:64,  def:64,  magic_def:0,  ranged_def:0,  type:"melee", weakness:"ranged", sprite:[`${WIKI}/Fire_giant_chathead.png`],         tokenReward:6000  },
      { id:"black_dragon",  name:"Black Dragon",  level:227, hp:240, atk:180, def:150, magic_def:65, ranged_def:70, type:"melee", weakness:"magic",  sprite:[`${WIKI}/Black_dragon_chathead.png`],       tokenReward:10000 },
    ],
  },
  {
    id: 5, name: "Phase 5", location: "Wilderness", difficulty: "Extreme",
    color: "#ef4444", bgColor: "rgba(239,68,68,0.1)",
    monsters: [
      { id:"greater_demon",  name:"Greater Demon",  level:92,  hp:87,  atk:89,  def:79,  magic_def:25, ranged_def:30, type:"melee", weakness:"magic",  sprite:[`${WIKI}/Greater_demon_chathead.png`],      tokenReward:20000 },
      { id:"kbd",            name:"King Black Dragon",level:276,hp:240, atk:240, def:245, magic_def:50, ranged_def:55, type:"melee", weakness:"ranged", sprite:[`${WIKI}/King_Black_Dragon_chathead.png`],  tokenReward:50000 },
      { id:"chaos_elemental",name:"Chaos Elemental", level:305,hp:250, atk:250, def:230, magic_def:60, ranged_def:60, type:"magic", weakness:"ranged", sprite:[`${WIKI}/Chaos_Elemental_chathead.png`],    tokenReward:75000 },
    ],
  },
];
