import type { GranularityInput } from "./types";

/** Provenance only — Gate code must not read workId. */
export type FixtureCase = {
  id: "A" | "B" | "C" | "D";
  label: string;
  expectedStatus: "PASS" | "FAIL";
  expectedErrorInvariants: Array<"G1" | "G2" | "G3" | "G4">;
  provenance?: { workId?: string; capturedAt?: string; note?: string };
  input: GranularityInput;
};

const SOURCE_A = `1. **黄巾起义与招兵榜文**
东汉末年朝政腐败，宦官专权，加上连年天灾，民不聊生。巨鹿人张角与其弟张宝、张梁以“太平道”为名发动“黄巾起义”，声势浩大，朝廷官军节节败退。幽州太守刘焉为抵御叛军，采纳校尉邹靖的建议，向全郡发布招募义兵的榜文。这张榜文如同乱世的序幕，将散落于民间的高人志士聚集到了历史舞台的前沿。
2. **涿县偶遇与桃园结义**
中山靖王之后刘备在县城观看榜文时长吁短叹，正逢性格豪爽的张飞上前质问。二人相谈甚欢，遂入酒肆共饮。期间，身长九尺、威风凛凛的关羽也推车入店歇脚。三人志同道合，皆有匡扶天下之志，遂决定共同起兵。次日，他们在张飞庄后的桃园中设祭告天，焚香再拜，结为异姓兄弟，立下了“不求同年同月同日生，只愿同年同月同日死”的千古誓言，确立了刘备为兄、关羽次之、张飞为弟的秩序。
3. **中山豪商资助与神兵初成**
结义之后，三兄弟面临缺乏战马与兵器的窘境。恰逢中山大商人张世平、苏双往来贩马，因途中遭遇盗匪阻隔而来到张飞庄上。刘备热情款待并表明起兵讨贼之志，二商大为感动，慷慨资助良马五十匹、金银五百两以及镔铁一千斤。刘备利用这批镔铁打造了属于三人的标志性武器：刘备的双股剑、关羽重八十二斤的青龙偃月刀（又名冷艳锯），以及张飞丈八点钢矛，同时缝制铠甲、召集乡勇，正式建立起第一支精锐的军事力量。
4. **大兴山首战告捷**
刘备率领五百余名乡勇随邹靖出征，在大兴山下迎战黄巾军将领程远志与副将邓茂。面对数万敌军，三兄弟毫无惧色。阵前交锋中，张飞挺枪而出，一矛将邓茂刺落马下；程远志大怒挺刀来迎，关羽挥舞青龙偃月刀迎面斩下，直接将其砍翻在地。主将双双阵亡导致黄巾军溃不成军，刘备顺势掩杀，收降投降者无数，取得了起兵后的开门红。
5. **救援董卓与遭遇冷落**
首战获胜后，刘备一行转战青州解围，随后又受命救援遭黄巾军围攻的中郎将董卓。刘备三兄弟冒死冲杀，杀退黄巾军，成功将董卓救出危难之中。然而，当董卓得知刘备三人既无官职也无门第背景后，态度瞬间变得极其傲慢与轻视。张飞大怒，提刀欲入帐斩杀董卓，幸被刘备与关羽死死劝阻。这一幕深刻揭示了东汉末年门阀阶级的偏见，也预示了董卓日后独揽大权、祸乱朝纲的阴险本性。`;

/** Known-bad Discovery topology from primary Work (second Propose). Captions may be decent; Story/Frame cardinality is not. */
export const FIXTURE_A: FixtureCase = {
  id: "A",
  label: "Known bad — outline mirrored as 5 Stories × 1 Frame",
  expectedStatus: "FAIL",
  expectedErrorInvariants: ["G1", "G4"],
  provenance: {
    workId: "42c22be9-ac88-4407-90cf-19cf79847d07",
    capturedAt: "2026-08-19T02:05:04.590Z",
    note: "Propose snapshot. Gate must not branch on this workId.",
  },
  input: {
    sourceText: SOURCE_A,
    stories: [
      {
        id: "e09b0ecf-c629-4392-8824-289f62a0e8f2",
        title: "The Yellow Turban Rebellion and the Call to Arms",
        summary:
          "The corrupt Eastern Han court faces the massive Yellow Turban Rebellion led by Zhang Jue, prompting the commandery to issue a nationwide call for volunteer fighters.",
      },
      {
        id: "c5d47f36-f425-4fba-a659-3f70fd0a8720",
        title: "The Peach Garden Oath",
        summary:
          "Liu Bei, Guan Yu, and Zhang Fei meet by chance in Zhuozhou, recognize their shared ambitions to save the realm, and swear brotherhood in a peach garden.",
      },
      {
        id: "a1bbcaf4-c868-4622-be42-1b1aad431ad9",
        title: "Support from Merchants and Forging of Iconic Arms",
        summary:
          "Wealthy merchants Zhang Shiping and Su Shuang provide vital supplies and funds, enabling the three brothers to forge their legendary weapons and form their first militia.",
      },
      {
        id: "88680725-b10f-4cf0-b8f3-e55d3d407ece",
        title: "First Victory at Mount Daxing",
        summary:
          "Led by Zou Jing, the newly formed volunteer force under Liu Bei achieves its first major battlefield victory against Yellow Turban commanders at Mount Daxing.",
      },
      {
        id: "cb704ccb-8ab1-463d-ab49-2a863437a08c",
        title: "Rescuing Dong Zhuo and Facing Arrogance",
        summary:
          "The three brothers rescue Imperial Commander Dong Zhuo from rebel forces, only to be treated with scorn and disdain due to their lack of official rank or noble pedigree.",
      },
    ],
    frames: [
      {
        id: "scene-1",
        parentStoryId: "e09b0ecf-c629-4392-8824-289f62a0e8f2",
        title: "The Yellow Turban Rebellion and Call to Arms",
        caption:
          "At the end of the Eastern Han dynasty, corruption and natural disasters lead to widespread suffering and the rise of the Yellow Turban Rebellion, a peasant uprising led by Zhang Jue. To counter the threat, Prefect Liu Yan posts a recruitment notice in Zhuozhou to gather volunteers.",
      },
      {
        id: "scene-2",
        parentStoryId: "c5d47f36-f425-4fba-a659-3f70fd0a8720",
        title: "The Peach Garden Oath",
        caption:
          "Liu Bei, Guan Yu, and Zhang Fei cross paths while reading the recruitment notice in Zhuozhou. Bonding over drinks, they share their grand aspirations and swear an oath of brotherhood in a peach orchard, establishing a lifelong bond to restore peace.",
      },
      {
        id: "scene-3",
        parentStoryId: "a1bbcaf4-c868-4622-be42-1b1aad431ad9",
        title: "Support from Merchants and Forging of Iconic Arms",
        caption:
          "After the peach garden oath, the trio receives generous material support from merchants Zhang Shiping and Su Shuang. Liu Bei uses the donated iron to forge his twin swords, Guan Yu's Green Dragon Crescent Blade, and Zhang Fei's Serpent Spear, officially equipping their new militia.",
      },
      {
        id: "scene-4",
        parentStoryId: "88680725-b10f-4cf0-b8f3-e55d3d407ece",
        title: "First Victory at Mount Daxing",
        caption:
          "Liu Bei and his newly assembled militia join commander Zou Jing at Mount Daxing to face the rebel forces. Zhang Fei and Guan Yu swiftly slay enemy leaders Deng Mao and Cheng Yuanzhi in single combat, routing the Yellow Turban army and securing a triumphant debut.",
      },
      {
        id: "scene-5",
        parentStoryId: "cb704ccb-8ab1-463d-ab49-2a863437a08c",
        title: "Rescuing Dong Zhuo and Facing Arrogance",
        caption:
          "Following their initial success, Liu Bei's forces rescue the imperial officer Dong Zhuo from a siege. Despite saving his life, Dong Zhuo displays haughty contempt upon learning of their humble backgrounds, nearly provoking Zhang Fei into executing him on the spot.",
      },
    ],
  },
};

export const FIXTURE_B: FixtureCase = {
  id: "B",
  label: "Valid 1 Story × 4 Frames",
  expectedStatus: "PASS",
  expectedErrorInvariants: [],
  input: {
    sourceText: `Winterfell receives royal news. Ned takes the Handship. The family splits between North and South. The king's party departs.`,
    stories: [
      {
        id: "story-arc",
        title: "The King Rides North",
        summary:
          "Robert Baratheon visits Winterfell, names Eddard Stark Hand of the King, and the household must accept the cost of leaving the North.",
      },
    ],
    frames: [
      {
        id: "f1",
        parentStoryId: "story-arc",
        title: "Setup",
        caption:
          "Robert Baratheon, king of the realm, arrives at Winterfell with the royal party.",
      },
      {
        id: "f2",
        parentStoryId: "story-arc",
        title: "Conflict",
        caption:
          "Robert names Eddard Stark, warden of the North, as Hand of the King, forcing a choice that will uproot the household.",
      },
      {
        id: "f3",
        parentStoryId: "story-arc",
        title: "Reversal",
        caption:
          "Catelyn and Ned argue the cost: honor in the south versus keeping the family in Winterfell.",
      },
      {
        id: "f4",
        parentStoryId: "story-arc",
        title: "Consequence",
        caption:
          "Ned accepts the Handship; the king’s party prepares to leave Winterfell with Stark children in tow.",
      },
    ],
  },
};

export const FIXTURE_C: FixtureCase = {
  id: "C",
  label: "Valid 1 Story × 1 Frame",
  expectedStatus: "PASS",
  expectedErrorInvariants: [],
  input: {
    sourceText: `A raven lands in the yard. Maester Luwin reads a one-line death notice: Jon Arryn is dead.`,
    stories: [
      {
        id: "story-raven",
        title: "The Raven",
        summary: "A single raven brings word that Jon Arryn is dead.",
      },
    ],
    frames: [
      {
        id: "f1",
        parentStoryId: "story-raven",
        title: "The Notice",
        caption:
          "Maester Luwin reads a raven-borne notice: Jon Arryn, Hand of the King, is dead.",
      },
    ],
  },
};

export const FIXTURE_D: FixtureCase = {
  id: "D",
  label: "Information loss — labeled plot turn missing from caption",
  expectedStatus: "FAIL",
  expectedErrorInvariants: ["G3"],
  input: {
    sourceText: `After the rescue, Dong Zhuo scorns the brothers. Zhang Fei nearly kills him until Liu Bei and Guan Yu restrain him.`,
    stories: [
      {
        id: "story-dong",
        title: "Rescuing Dong Zhuo and Facing Contempt",
        summary:
          "The trio rescues Dong Zhuo from a Yellow Turban siege. Zhang Fei nearly kills Dong Zhuo until Liu Bei and Guan Yu restrain him.",
      },
    ],
    frames: [
      {
        id: "f1",
        parentStoryId: "story-dong",
        title: "Contempt",
        caption: "Dong Zhuo displays arrogance toward his rescuers.",
      },
    ],
    labels: {
      requiredTurns: [
        "Zhang Fei nearly kills Dong Zhuo until Liu Bei and Guan Yu restrain him",
      ],
    },
  },
};

export const FIXTURES: FixtureCase[] = [
  FIXTURE_A,
  FIXTURE_B,
  FIXTURE_C,
  FIXTURE_D,
];
