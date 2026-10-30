# main.py
import pygame
import sys
import math  # Import the math module for trigonometric functions

# Initialize Pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 700, 750  # Increased height to accommodate the turn display
ROWS, COLS = 7, 7
BOX_SIZE = WIDTH // COLS

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (180, 180, 180)
RED = (255, 102, 102)
GREEN = (102, 255, 102)
BLUE = (102, 178, 255)
YELLOW = (255, 255, 102)

# Create the screen
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Chain Reaction Game")

# Coin class
class Coin:
    def __init__(self, row, col, player):
        self.row = row
        self.col = col
        self.player = player
        self.points = 1

    def draw(self, screen):
        color = RED if self.player == 1 else GREEN
        center_x = self.col * BOX_SIZE + BOX_SIZE // 2
        center_y = self.row * BOX_SIZE + BOX_SIZE // 2 + 50  # Adjust for turn display
        pygame.draw.circle(screen, color, (center_x, center_y), BOX_SIZE // 4)
        dot_radius = 5
        dot_color = BLACK
        for i in range(self.points):
            angle = i * (360 / self.points)
            offset_x = int(dot_radius * 3 * (self.points - 1) * math.cos(math.radians(angle)))  # Use math module
            offset_y = int(dot_radius * 3 * (self.points - 1) * math.sin(math.radians(angle)))  # Use math module
            pygame.draw.circle(screen, dot_color, (center_x + offset_x, center_y + offset_y), dot_radius)

    def increment_points(self):
        self.points += 1
        if self.points > 4:
            self.points = 1
            self.player = 2 if self.player == 1 else 1  # Change player after completing a cycle

    def explode(self):
        return self.points == 4

# List to hold coins
coins = []

# Draw the grid
def draw_grid():
    for row in range(ROWS):
        for col in range(COLS):
            pygame.draw.rect(screen, GRAY, (col * BOX_SIZE, row * BOX_SIZE + 50, BOX_SIZE, BOX_SIZE), 0)
            pygame.draw.rect(screen, BLACK, (col * BOX_SIZE, row * BOX_SIZE + 50, BOX_SIZE, BOX_SIZE), 1)

# Check if a box is clicked
def get_box_clicked(pos):
    x, y = pos
    if y < 50:  # Ignore clicks above the grid
        return None, None
    row = (y - 50) // BOX_SIZE
    col = x // BOX_SIZE
    return row, col

# Get coin at a specific grid location
def get_coin(row, col):
    for coin in coins:
        if coin.row == row and coin.col == col:
            return coin
    return None

# Check if there are opponent's coins left
def opponent_coins_exist(current_player):
    for coin in coins:
        if coin.player != current_player:
            return True
    return False

# Handle explosions and spread to adjacent cells
def handle_explosions():
    global coins
    new_coins = []
    exploded = False
    for coin in coins:
        if coin.explode():
            exploded = True
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                new_row, new_col = coin.row + dy, coin.col + dx
                if 0 <= new_row < ROWS and 0 <= new_col < COLS:
                    adjacent_coin = get_coin(new_row, new_col)
                    if adjacent_coin:
                        if adjacent_coin.player != coin.player:
                            adjacent_coin.player = coin.player
                        adjacent_coin.increment_points()
                    else:
                        new_coins.append(Coin(new_row, new_col, coin.player))
        else:
            new_coins.append(coin)
    coins = new_coins
    return exploded

# Main game loop
def main():
    player_turn = 1
    font = pygame.font.SysFont(None, 55)
    title_font = pygame.font.SysFont(None, 70)
    game_over_font = pygame.font.SysFont(None, 70)
    game_over = False
    
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.MOUSEBUTTONDOWN and not game_over:
                x, y = event.pos
                row, col = get_box_clicked((x, y))
                if row is not None and col is not None:
                    coin = get_coin(row, col)
                    if coin:
                        if coin.player == player_turn:
                            coin.increment_points()
                            player_turn = 2 if player_turn == 1 else 1  # Switch turn after placing a dot
                            if not opponent_coins_exist(player_turn):
                                game_over = True
                    else:
                        coins.append(Coin(row, col, player_turn))
                        player_turn = 2 if player_turn == 1 else 1  # Switch turn after placing a new coin
                        if not opponent_coins_exist(player_turn):
                            game_over = True

        screen.fill(WHITE)
        
        # Draw game title
        title_text = "Chain Reaction Game"
        title_surface = title_font.render(title_text, True, BLACK)
        screen.blit(title_surface, (WIDTH // 2 - title_surface.get_width() // 2, 10))
        
        if game_over:
            # Display game over message and winner
            winner_text = f"Player {player_turn} Wins!"
            winner_surface = game_over_font.render(winner_text, True, BLACK)
            screen.blit(winner_surface, (WIDTH // 2 - winner_surface.get_width() // 2, HEIGHT // 2 - winner_surface.get_height() // 2))
        else:
            # Display current player's turn
            turn_text = f"Player {player_turn}'s Turn"
            turn_surface = font.render(turn_text, True, BLACK)
            screen.blit(turn_surface, (WIDTH // 2 - turn_surface.get_width() // 2, 70))
            
            draw_grid()
            for coin in coins:
                coin.draw(screen)
        
        pygame.display.flip()

        while handle_explosions():
            screen.fill(WHITE)
            if game_over:
                # Display game over message and winner
                screen.blit(winner_surface, (WIDTH // 2 - winner_surface.get_width() // 2, HEIGHT // 2 - winner_surface.get_height() // 2))
            else:
                # Display current player's turn
                screen.blit(turn_surface, (WIDTH // 2 - turn_surface.get_width() // 2, 70))
                draw_grid()
                for coin in coins:
                    coin.draw(screen)
            
            pygame.display.flip()

if __name__ == "__main__":
    main()
