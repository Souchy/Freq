import { bindable, ILogger, resolve } from "aurelia";
import { player_commands } from "../../generated/specta/commands/player_commands";

export class WelcomePage {
  public readonly logger = resolve(ILogger).scopeTo("WelcomePage");
  public message = 'Welcome to Aurelia 2!';


  @bindable
  filePath = '';

  isPlaying = false;
  isPaused = false;
  hasFile = false;
  errorMessage = '';

  async play() {
    if (!this.filePath) {
      this.errorMessage = 'Please enter a local audio file path.';
      return;
    }

    this.errorMessage = '';
    try {
      let result = await player_commands.loadAndPlayFile(this.filePath);
      if (result.status === 'error') {
        this.logger.error(`Failed to play file: ${result.error}`);
        this.errorMessage = `Failed to play file: ${result.error}`;
        this.isPlaying = false;
        this.isPaused = false;
        return;
      } else {
        this.logger.info(`Playing file: ${this.filePath}`);
      }
      this.isPlaying = true;
      this.isPaused = false;
      this.hasFile = true;
    } catch (err: any) {
      this.logger.error(`Failed to play file: ${err.message}`);
      this.errorMessage = `Failed to play file: ${err.message}`;
      this.isPlaying = false;
      this.isPaused = false;
    }
  }

  async pause() {
    try {
      await player_commands.pause();
      this.isPaused = true;
      this.isPlaying = false;
    } catch (err: any) {
      this.logger.error(`Failed to pause file: ${err.message}`);
      this.errorMessage = `Failed to pause file: ${err.message}`;
    }
  }

  async resume() {
    try {
      await player_commands.resume();
      this.isPaused = false;
      this.isPlaying = true;
    } catch (err: any) {
      this.logger.error(`Failed to resume file: ${err.message}`);
      this.errorMessage = `Failed to resume file: ${err.message}`;
    }
  }

  async stop() {
    try {
      await player_commands.stop();
      this.isPlaying = false;
      this.isPaused = false;
      this.hasFile = false;
    } catch (err: any) {
      this.logger.error(`Failed to stop file: ${err.message}`);
      this.errorMessage = `Failed to stop file: ${err.message}`;
    }
  }
}
