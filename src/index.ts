import './style.css'
import * as Phaser from 'phaser';
import { scenes } from './scene/index';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,  // webGLを使うかcanvasを使うかをphaserが自動で判断してくれる
    width: 960,
    height: 800,
    parent: 'game-app',  // #game-app内にcanvasを生成
    scene: scenes,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
};

new Phaser.Game(config);
