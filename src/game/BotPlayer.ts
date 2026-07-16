import Player from "./Player";
import { PlayerAction } from "./PlayerAction";
import PokerEngine from "./PokerEngine";

export default class BotPlayer extends Player {

  isBot = true;


  constructor(id:string, username:string){
    super(id, username, 10000);
  }



  async play(engine: PokerEngine){

    const delay =
      Math.floor(Math.random()*2000)+1000;


    await new Promise(
      resolve=>setTimeout(resolve, delay)
    );


    const strength =
      Math.random();



    const currentBet =
      Math.max(
        ...engine.room.players.map(
          p=>p.currentBet
        )
      );


    // دست ضعیف
    if(strength < 0.2){

      return {
        action:PlayerAction.FOLD,
        amount:0
      };

    }



    // دست متوسط
    if(strength < 0.7){

      return {
        action:PlayerAction.CALL,
        amount:0
      };

    }



    // دست قوی
    return {
      action:PlayerAction.RAISE,
      amount:10
    };

  }

}