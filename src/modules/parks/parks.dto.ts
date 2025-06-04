import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class ParkQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  continent?: string;

  @IsOptional()
  @IsNumber()
  parkGroupId?: number;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  openThreshold?: number; // Percentage threshold for park to be considered "open" (default: 50)
}
